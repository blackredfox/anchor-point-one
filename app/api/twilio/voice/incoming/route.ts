import { phoneRequestId } from "@/lib/conversation-routing";
import { ensureDatabase, getBindings } from "@/lib/database";
import { sendIncomingCallNotification } from "@/lib/notifications";
import { validateTwilioRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const CONSENT_PROMPT = "Thank you for calling Anchor Point One. I'm helping another customer right now. To receive a text with instructions for sending your RV issue and photos, press 1. Service text frequency varies. Message and data rates may apply. In our texts, reply HELP for help or STOP to opt out. To receive the text now, press 1.";
const RETURNING_CALLER_GREETING = "Thank you for calling Anchor Point One. We may be assisting another customer and unable to answer right away. We will send a text message to this number so you can continue your service request.";
const OPTED_OUT_GREETING = "Thank you for calling Anchor Point One. You previously opted out of text messages. To receive text instructions again, please hang up and text START to this number.";

const xmlEscape = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const voiceXml = (body: string, status = 200) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
  { status, headers: { "content-type": "text/xml; charset=utf-8" } },
);

const privateToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const bindings = getBindings();
  const webhookUrl = bindings.TWILIO_VOICE_WEBHOOK_URL;
  if (!webhookUrl) return voiceXml("", 503);
  if (!await validateTwilioRequest(request, parameters, webhookUrl)) return voiceXml("", 403);

  const callSid = parameters.get("CallSid")?.trim() ?? "";
  const from = parameters.get("From")?.trim() ?? "";
  if (!/^CA[a-zA-Z0-9]{20,64}$/.test(callSid) || !/^\+1\d{10}$/.test(from)) {
    return voiceXml("", 400);
  }

  const db = await ensureDatabase();
  const active = await db.prepare(`SELECT service_requests.id
      FROM phone_conversations
      INNER JOIN service_requests ON service_requests.id=phone_conversations.active_request_id
      WHERE phone_conversations.phone_e164=? LIMIT 1`)
    .bind(from)
    .first<{ id: string }>();
  const previous = active ? null : await db.prepare(`SELECT id FROM service_requests
      WHERE phone=? ORDER BY updated_at DESC LIMIT 1`)
    .bind(from)
    .first<{ id: string }>();
  const requestId = active?.id ?? previous?.id ?? await phoneRequestId(from);
  const isNewInquiry = !active && !previous;
  const now = Date.now();
  const statements: Array<ReturnType<typeof db.prepare>> = [];
  if (isNewInquiry) {
    statements.push(
      db.prepare("INSERT OR IGNORE INTO service_requests (id,access_token,customer_name,email,phone,address,service_type,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(requestId, privateToken(), `Phone caller ${from.slice(-4)}`, "", from, "", "not_sure", "Incoming phone call to Anchor Point One.", "received", now, now),
      db.prepare("INSERT OR IGNORE INTO request_preferences (request_id,submission_key,preferred_contact_method,rv_details,equipment_model,appointment_preference,city,postal_code,rv_type,source_channel) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(requestId, crypto.randomUUID(), "web", "", "", "", "", "", "", "voice"),
    );
  }
  statements.push(
    db.prepare("INSERT OR IGNORE INTO twilio_voice_calls (call_sid,request_id,from_phone,recording_status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(callSid, requestId, from, "pending", now, now),
    db.prepare(`INSERT INTO phone_conversations (phone_e164,active_request_id,last_activity_at,last_ack_at)
      VALUES (?,?,?,NULL) ON CONFLICT(phone_e164) DO UPDATE SET
      active_request_id=excluded.active_request_id,last_activity_at=MAX(phone_conversations.last_activity_at,excluded.last_activity_at)`)
      .bind(from, requestId, now),
  );
  await db.batch(statements);

  const consent = await db.prepare(`SELECT request_id,opted_out_at FROM sms_consents
      WHERE phone_e164=?
      ORDER BY consented_at DESC LIMIT 1`)
    .bind(from)
    .first<{ request_id: string; opted_out_at: number | null }>();

  const reserved = await db.prepare(`UPDATE twilio_voice_calls SET notification_sent_at=-1,updated_at=?
    WHERE call_sid=? AND notification_sent_at IS NULL`)
    .bind(Date.now(), callSid)
    .run();
  if (reserved.meta.changes) {
    const sent = await sendIncomingCallNotification({
      requestId,
      phone: from,
      origin: new URL(request.url).origin,
    }).catch(() => "failed" as const);
    await db.prepare("UPDATE twilio_voice_calls SET notification_sent_at=?,updated_at=? WHERE call_sid=?")
      .bind(sent === "sent" ? Date.now() : null, Date.now(), callSid)
      .run();
  }

  const followUpUrl = new URL("/api/twilio/voice/sms-follow-up", webhookUrl).toString();
  if (consent?.opted_out_at) {
    return voiceXml(
      `<Say voice="Polly.Joanna" language="en-US">${xmlEscape(OPTED_OUT_GREETING)}</Say><Hangup/>`,
    );
  }
  if (consent) {
    return voiceXml(
      `<Say voice="Polly.Joanna" language="en-US">${xmlEscape(RETURNING_CALLER_GREETING)}</Say><Redirect method="POST">${xmlEscape(followUpUrl)}</Redirect>`,
    );
  }
  return voiceXml(
    `<Gather input="dtmf" numDigits="1" timeout="8" action="${xmlEscape(followUpUrl)}" method="POST"><Say voice="Polly.Joanna" language="en-US">${xmlEscape(CONSENT_PROMPT)}</Say></Gather><Hangup/>`,
  );
}
