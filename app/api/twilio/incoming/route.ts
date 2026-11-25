import { removeStoredAttachments, storeTwilioMedia } from "@/lib/attachments";
import { extractRequestReference } from "@/lib/conversation-routing";
import { ensureDatabase } from "@/lib/database";
import { findIntakeRequest, meaningfulSms, prepareIntake } from "@/lib/intake";
import { deliverIntakeNotifications } from "@/lib/notifications";
import { validateTwilioRequest } from "@/lib/twilio";
import { callerPattern, quarantinedCaller, voiceXml } from "@/lib/voice-intake";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  if (!await validateTwilioRequest(request, parameters)) return voiceXml("", 403);

  const sid = parameters.get("MessageSid")?.trim() ?? "";
  const phone = parameters.get("From")?.trim() ?? "";
  const body = parameters.get("Body")?.trim() ?? "";
  const command = (parameters.get("OptOutType") || body).trim().toUpperCase();
  const count = Number(parameters.get("NumMedia") ?? "0");
  if (!/^(?:SM|MM)[a-zA-Z0-9]{20,64}$/.test(sid) || !callerPattern.test(phone) ||
      !Number.isInteger(count) || count < 0 || count > 6 || body.length > 1600) {
    return voiceXml("", 400);
  }
  const media = Array.from({ length: count }, (_, index) => ({
    url: parameters.get(`MediaUrl${index}`) ?? "",
    contentType: parameters.get(`MediaContentType${index}`)?.toLowerCase() ?? "",
  }));
  if (media.some((item) => !item.url || !item.contentType)) return voiceXml("", 400);

  const db = await ensureDatabase();
  const duplicate = () => db.prepare(`SELECT sid FROM intake_message_events WHERE sid=?
    UNION ALL SELECT sid FROM twilio_message_events WHERE sid=? LIMIT 1`).bind(sid, sid).first();
  if (await duplicate()) return voiceXml();
  const now = Date.now();
  const event = (kind: string) => db.prepare("INSERT INTO intake_message_events (sid,phone,created_at,kind) VALUES (?,?,?,?)")
    .bind(sid, phone, now, kind);
  const stopped = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"].includes(command);
  const started = ["START", "UNSTOP"].includes(command);
  const control = stopped || started || command === "HELP";
  const existing = control ? null : await findIntakeRequest(db, phone, extractRequestReference(body));
  try {
    if (stopped || started) {
      await db.batch([
        event(stopped ? "stop" : "start"),
        db.prepare(`INSERT INTO intake_sms_preferences (phone,opted_out) VALUES (?,?)
          ON CONFLICT(phone) DO UPDATE SET opted_out=excluded.opted_out`).bind(phone, stopped ? 1 : 0),
        db.prepare("UPDATE sms_consents SET opted_out_at=? WHERE phone_e164=?").bind(stopped ? now : null, phone),
      ]);
      return voiceXml();
    }
    if (control) {
      await event("help").run();
      return voiceXml();
    }
    const suspicious = /https?:\/\/|www\./i.test(body);
    const followUp = existing && !suspicious && (media.length > 0 || /\p{L}{2,}|\d{2,}/u.test(body));
    if ((!followUp && !meaningfulSms(body)) || (!existing && await quarantinedCaller(db, phone, now))) {
      await event("unverified").run();
      return voiceXml();
    }

    const description = body || "Media attachment received.";
    const intake = await prepareIntake(db, {
      phone, name: `SMS customer ${phone.slice(-4)}`, description, source: "sms", now, existing,
    });
    let attachments = [] as Awaited<ReturnType<typeof storeTwilioMedia>>;
    try {
      attachments = await storeTwilioMedia(intake.id, media);
    } catch {
      if (!body) return voiceXml("", 503);
      console.error("Incoming Twilio media could not be stored.");
    }

    try {
      await db.batch([
        ...intake.newRequest,
        event("accepted"),
        db.prepare("INSERT INTO twilio_message_events (sid,request_id,direction,created_at) VALUES (?,?,'inbound',?)")
          .bind(sid, intake.id, now),
        db.prepare(`INSERT INTO request_messages (request_id,author_type,body,created_at)
          SELECT ?,'customer',?,MAX(?,COALESCE(MAX(created_at),0)+1) FROM request_messages WHERE request_id=?`)
          .bind(intake.id, description, now, intake.id),
        ...attachments.map((file) => db.prepare(`INSERT INTO request_attachments
          (id,request_id,message_created_at,author_type,object_key,filename,content_type,size_bytes,created_at)
          VALUES (?,?,(SELECT MAX(created_at) FROM request_messages WHERE request_id=?),'customer',?,?,?,?,?)`)
          .bind(file.id, intake.id, intake.id, file.objectKey, file.filename, file.contentType, file.sizeBytes, now)),
        db.prepare(`INSERT OR IGNORE INTO sms_consents
          (request_id,phone_e164,consented_at,consent_version,consent_method,opted_out_at)
          VALUES (?,?,?,'customer-initiated','customer_initiated_sms',
            CASE WHEN (SELECT opted_out FROM intake_sms_preferences WHERE phone=?)=1 THEN ? ELSE NULL END)`)
          .bind(intake.id, phone, now, phone, now),
        db.prepare("UPDATE service_requests SET status=CASE WHEN status IN ('completed','closed') THEN 'follow_up_needed' ELSE status END,updated_at=MAX(updated_at,?) WHERE id=?").bind(now, intake.id),
        intake.link,
      ]);
    } catch (error) {
      await removeStoredAttachments(attachments);
      throw error;
    }
    await deliverIntakeNotifications(db, intake.id);
  } catch (error) {
    if (!await duplicate()) throw error;
  }
  return voiceXml();
}
