import { removeStoredAttachments, storeTwilioMedia } from "@/lib/attachments";
import { ACK_COOLDOWN_MS, extractRequestReference, phoneRequestId, selectConversationItem, shouldAutoAcknowledge } from "@/lib/conversation-routing";
import { ensureDatabase, getBindings } from "@/lib/database";
import { sendIncomingMessageNotification } from "@/lib/notifications";
import { directSmsInquiriesEnabled } from "@/lib/site-config";
import { recordTwilioDelivery, sendTwilioMessage, validateTwilioRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const AUTO_ACKNOWLEDGEMENT = "AnchorPoint: Thanks for reaching out. Please text your city/ZIP, RV year/make/model if applicable, what is happening, and 2–3 photos or a short video if available. We will review it and recommend the next step. No obligation just for contacting us. Reply STOP to opt out.";
const TWILIO_MESSAGE_SID = /^(?:SM|MM)[a-zA-Z0-9]{20,64}$/;

const xml = (status = 200) =>
  new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
    status,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });

const token = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

type ConversationItem = {
  id: string;
  opted_out_at: number | null;
  last_activity_at: number | null;
  last_ack_at: number | null;
};

function serviceTypeFromMessage(body: string) {
  if (/home service|home project|house|furniture|mount|shelv|caulk/i.test(body)) return "home";
  if (/\brv\b|motorhome|travel trailer|fifth wheel|camper/i.test(body)) return "rv";
  return "not_sure";
}

function mediaSummary(count: number) {
  if (!count) return "";
  return count === 1 ? "Media attachment received." : `${count} media attachments received.`;
}

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  if (!await validateTwilioRequest(request, parameters)) return xml(403);

  const sid = parameters.get("MessageSid")?.trim() ?? "";
  const from = parameters.get("From")?.trim() ?? "";
  const body = parameters.get("Body")?.trim() ?? "";
  const optOutType = parameters.get("OptOutType")?.trim().toUpperCase() ?? "";
  const rawNumMedia = Number(parameters.get("NumMedia") ?? "0");
  if (
    !TWILIO_MESSAGE_SID.test(sid) ||
    !/^\+1\d{10}$/.test(from) ||
    !Number.isInteger(rawNumMedia) ||
    rawNumMedia < 0 ||
    rawNumMedia > 6 ||
    body.length > 1600
  ) {
    return xml(400);
  }

  const media = Array.from({ length: rawNumMedia }, (_, index) => ({
    url: parameters.get(`MediaUrl${index}`)?.trim() ?? "",
    contentType: parameters.get(`MediaContentType${index}`)?.trim().toLowerCase() ?? "",
  }));
  if (media.some((item) => !item.url || !item.contentType)) return xml(400);
  if (!body && !media.length && !optOutType) return xml(400);

  const db = await ensureDatabase();
  const existing = await db.prepare("SELECT sid FROM twilio_message_events WHERE sid=?")
    .bind(sid)
    .first();
  if (existing) return xml();

  const reference = extractRequestReference(body);
  const referencedItem = reference
    ? await db.prepare(`SELECT service_requests.id,sms_consents.opted_out_at,
        phone_conversations.last_activity_at,phone_conversations.last_ack_at
      FROM service_requests
      LEFT JOIN sms_consents ON sms_consents.request_id=service_requests.id
      LEFT JOIN phone_conversations ON phone_conversations.phone_e164=?
      WHERE service_requests.phone=? AND UPPER(SUBSTR(service_requests.id,1,8))=?
      ORDER BY service_requests.updated_at DESC LIMIT 1`)
      .bind(from, from, reference)
      .first<ConversationItem>()
    : null;
  const activeItem = referencedItem
    ? null
    : await db.prepare(`SELECT service_requests.id,sms_consents.opted_out_at,
        phone_conversations.last_activity_at,phone_conversations.last_ack_at
      FROM phone_conversations
      INNER JOIN service_requests ON service_requests.id=phone_conversations.active_request_id
      LEFT JOIN sms_consents ON sms_consents.request_id=service_requests.id
      WHERE phone_conversations.phone_e164=? LIMIT 1`)
      .bind(from)
      .first<ConversationItem>();
  const eventItem = referencedItem || activeItem
    ? null
    : await db.prepare(`SELECT service_requests.id,sms_consents.opted_out_at,
        NULL AS last_activity_at,NULL AS last_ack_at
      FROM twilio_message_events
      INNER JOIN service_requests ON service_requests.id=twilio_message_events.request_id
      LEFT JOIN sms_consents ON sms_consents.request_id=service_requests.id
      WHERE service_requests.phone=?
      ORDER BY twilio_message_events.created_at DESC LIMIT 1`)
      .bind(from)
      .first<ConversationItem>();
  const previousRequest = referencedItem || activeItem || eventItem
    ? null
    : await db.prepare(`SELECT service_requests.id,sms_consents.opted_out_at,
        NULL AS last_activity_at,NULL AS last_ack_at
      FROM service_requests
      LEFT JOIN sms_consents ON sms_consents.request_id=service_requests.id
      WHERE service_requests.phone=?
      ORDER BY service_requests.updated_at DESC LIMIT 1`)
      .bind(from)
      .first<ConversationItem>();

  let item = selectConversationItem({ referencedItem, activeItem, eventItem, previousRequest });
  if (optOutType === "STOP" || optOutType === "START") {
    if (!item) return xml();
    const now = Date.now();
    const optedOutAt = optOutType === "STOP" ? now : null;
    await db.batch([
      db.prepare(`UPDATE sms_consents SET
        opted_out_at=?,
        consented_at=CASE WHEN ?='START' THEN ? ELSE consented_at END,
        consent_method=CASE WHEN ?='START' THEN 'sms_start' ELSE consent_method END,
        consent_call_sid=CASE WHEN ?='START' THEN NULL ELSE consent_call_sid END
        WHERE phone_e164=?`).bind(optedOutAt, optOutType, now, optOutType, optOutType, from),
      db.prepare("INSERT INTO twilio_message_events (sid,request_id,direction,created_at) VALUES (?,?,?,?)")
        .bind(sid, item.id, optOutType === "STOP" ? "inbound_opt_out" : "inbound_opt_in", now),
      db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
        .bind(item.id, "system", optOutType === "STOP" ? "Customer opted out of SMS messages." : "Customer opted back in to SMS messages.", now),
      db.prepare("UPDATE service_requests SET updated_at=? WHERE id=?").bind(now, item.id),
      db.prepare(`INSERT INTO phone_conversations (phone_e164,active_request_id,last_activity_at,last_ack_at)
        VALUES (?,?,?,NULL) ON CONFLICT(phone_e164) DO UPDATE SET
        active_request_id=excluded.active_request_id,last_activity_at=excluded.last_activity_at`)
        .bind(from, item.id, now),
    ]);
    return xml();
  }

  if (item?.opted_out_at) return xml();
  if (!item && !directSmsInquiriesEnabled) return xml();

  const now = Date.now();
  const isNewInquiry = !item;
  const previousLastActivity = Number(item?.last_activity_at ?? 0);
  const previousLastAck = Number(item?.last_ack_at ?? 0);
  if (!item) {
    item = { id: await phoneRequestId(from), opted_out_at: null, last_activity_at: null, last_ack_at: null };
  }

  let stored = [] as Awaited<ReturnType<typeof storeTwilioMedia>>;
  let attachmentFailure = false;
  try {
    stored = await storeTwilioMedia(item.id, media);
  } catch (error) {
    attachmentFailure = media.length > 0;
    console.error("Incoming Twilio media could not be stored.", error instanceof Error ? error.name : "UnknownError");
  }

  const messageBody = body || mediaSummary(media.length);
  const statements: Array<ReturnType<typeof db.prepare>> = [];
  if (isNewInquiry) {
    const serviceType = serviceTypeFromMessage(body);
    statements.push(
      db.prepare("INSERT OR IGNORE INTO service_requests (id,access_token,customer_name,email,phone,address,service_type,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(item.id, token(), `SMS customer ${from.slice(-4)}`, "", from, "", serviceType, messageBody, "received", now, now),
      db.prepare("INSERT OR IGNORE INTO request_preferences (request_id,submission_key,preferred_contact_method,rv_details,equipment_model,appointment_preference,city,postal_code,rv_type,source_channel) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(item.id, crypto.randomUUID(), "text", "", "", "", "", "", "", "sms"),
      db.prepare("INSERT OR IGNORE INTO sms_consents (request_id,phone_e164,consented_at,consent_version,consent_method,consent_call_sid) VALUES (?,?,?,?,?,NULL)")
        .bind(item.id, from, now, "customer-initiated-2026-09-13", "customer_initiated_sms"),
    );
  } else {
    statements.push(
      db.prepare("INSERT OR IGNORE INTO sms_consents (request_id,phone_e164,consented_at,consent_version,consent_method,consent_call_sid) VALUES (?,?,?,?,?,NULL)")
        .bind(item.id, from, now, "customer-initiated-2026-09-13", "customer_initiated_sms"),
      db.prepare("UPDATE request_preferences SET preferred_contact_method='text' WHERE request_id=? AND source_channel='voice'")
        .bind(item.id),
    );
  }
  statements.push(
    db.prepare("INSERT INTO twilio_message_events (sid,request_id,direction,created_at) VALUES (?,?,?,?)")
      .bind(sid, item.id, "inbound", now),
    db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
      .bind(item.id, "customer", messageBody, now),
    ...stored.map((attachment) =>
      db.prepare("INSERT INTO request_attachments (id,request_id,message_created_at,author_type,object_key,filename,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(attachment.id, item!.id, now, "customer", attachment.objectKey, attachment.filename, attachment.contentType, attachment.sizeBytes, now)
    ),
    ...(attachmentFailure ? [db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
      .bind(item.id, "system", "An incoming media attachment could not be stored. Review the original message in Twilio.", now + 1)] : []),
    db.prepare("UPDATE service_requests SET status=CASE WHEN status IN ('received','completed','closed') THEN 'in_review' ELSE status END,updated_at=? WHERE id=?")
      .bind(now, item.id),
    db.prepare(`INSERT INTO phone_conversations (phone_e164,active_request_id,last_activity_at,last_ack_at)
      VALUES (?,?,?,NULL) ON CONFLICT(phone_e164) DO UPDATE SET
      active_request_id=excluded.active_request_id,last_activity_at=MAX(phone_conversations.last_activity_at,excluded.last_activity_at)`)
      .bind(from, item.id, now),
  );

  let batchResults: Awaited<ReturnType<typeof db.batch>>;
  try {
    batchResults = await db.batch(statements);
  } catch (error) {
    await removeStoredAttachments(stored);
    throw error;
  }
  const actuallyNewInquiry = isNewInquiry && Number(batchResults[0]?.meta.changes ?? 0) > 0;

  await sendIncomingMessageNotification({
    requestId: item.id,
    phone: from,
    body,
    attachmentCount: stored.length,
    createdAt: now,
    origin: new URL(request.url).origin,
    isNewInquiry: actuallyNewInquiry,
  }).catch((error) => {
    console.error("Incoming message notification failed.", error instanceof Error ? error.name : "UnknownError");
    return "failed" as const;
  });

  if (
    directSmsInquiriesEnabled &&
    getBindings().TWILIO_AUTO_ACK_ENABLED === "true" &&
    shouldAutoAcknowledge(now, previousLastActivity, previousLastAck)
  ) {
    const reserved = await db.prepare(`UPDATE phone_conversations SET last_ack_at=?
      WHERE phone_e164=? AND (last_ack_at IS NULL OR last_ack_at<=?)`)
      .bind(now, from, now - ACK_COOLDOWN_MS)
      .run();
    if (!reserved.meta.changes) return xml();
    const sent = await sendTwilioMessage(from, AUTO_ACKNOWLEDGEMENT);
    if (sent.ok) {
      const inserted = await db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
        .bind(item.id, "system", AUTO_ACKNOWLEDGEMENT, now + 2)
        .run();
      const messageId = Number(inserted.meta.last_row_id);
      if (messageId) {
        await recordTwilioDelivery(db, {
          sid: sent.sid,
          requestId: item.id,
          messageId,
          direction: "outbound_auto_ack",
          status: sent.status,
          createdAt: now + 2,
        });
      }
    }
  }

  return xml();
}
