import { ensureDatabase, getBindings } from "@/lib/database";
import { recordTwilioDelivery, sendTwilioMessage, validateTwilioRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const FOLLOW_UP_SMS = "Anchor Point One: Reply with city/ZIP, RV year/make/model, issue details & photos/video. We will review and suggest next steps. No obligation. STOP to opt out.";

const xmlEscape = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const voiceXml = (message: string, status = 200) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Say voice="Polly.Joanna" language="en-US">${xmlEscape(message)}</Say>` : ""}<Hangup/></Response>`,
  { status, headers: { "content-type": "text/xml; charset=utf-8" } },
);

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const voiceWebhookUrl = getBindings().TWILIO_VOICE_WEBHOOK_URL;
  if (!voiceWebhookUrl) return voiceXml("", 503);
  const expectedUrl = new URL("/api/twilio/voice/sms-follow-up", voiceWebhookUrl).toString();
  if (!await validateTwilioRequest(request, parameters, expectedUrl)) return voiceXml("", 403);

  const callSid = parameters.get("CallSid")?.trim() ?? "";
  const digits = parameters.get("Digits")?.trim() ?? "";
  if (!/^CA[a-zA-Z0-9]{20,64}$/.test(callSid) || (digits && digits !== "1")) {
    return voiceXml("", 400);
  }

  const db = await ensureDatabase();
  const call = await db.prepare("SELECT request_id,from_phone FROM twilio_voice_calls WHERE call_sid=?")
    .bind(callSid)
    .first<{ request_id: string; from_phone: string }>();
  if (!call) return voiceXml("", 404);

  const now = Date.now();
  if (digits === "1") {
    const optedOut = await db.prepare(`SELECT request_id FROM sms_consents
        WHERE phone_e164=? AND opted_out_at IS NOT NULL
        ORDER BY opted_out_at DESC LIMIT 1`)
      .bind(call.from_phone)
      .first<{ request_id: string }>();
    if (optedOut) {
      return voiceXml("You previously opted out of text messages. Please hang up and text START to this number to opt back in.");
    }
    await db.prepare(`INSERT INTO sms_consents
        (request_id,phone_e164,consented_at,consent_version,consent_method,consent_call_sid,opted_out_at)
        VALUES (?,?,?,'voice-keypress-2026-09-13','Voice/IVR - Press 1',?,NULL)
        ON CONFLICT(request_id) DO UPDATE SET
          phone_e164=excluded.phone_e164,
          consented_at=excluded.consented_at,
          consent_version=excluded.consent_version,
          consent_method=excluded.consent_method,
          consent_call_sid=excluded.consent_call_sid,
          opted_out_at=NULL`)
      .bind(call.request_id, call.from_phone, now, callSid)
      .run();
  }

  const consent = await db.prepare(`SELECT request_id FROM sms_consents
      WHERE phone_e164=? AND opted_out_at IS NULL
      ORDER BY consented_at DESC LIMIT 1`)
    .bind(call.from_phone)
    .first<{ request_id: string }>();
  if (!consent) return voiceXml("No text message was sent. You can text this number whenever you are ready.");

  const reserved = await db.prepare(`UPDATE twilio_voice_calls
      SET sms_follow_up_sent_at=-1,updated_at=?
      WHERE call_sid=? AND sms_follow_up_sent_at IS NULL`)
    .bind(now, callSid)
    .run();
  if (!reserved.meta.changes) {
    return voiceXml("The text message has already been sent. Thank you.");
  }

  const sent = await sendTwilioMessage(call.from_phone, FOLLOW_UP_SMS);
  if (!sent.ok) {
    await db.prepare("UPDATE twilio_voice_calls SET sms_follow_up_sent_at=NULL,updated_at=? WHERE call_sid=?")
      .bind(Date.now(), callSid)
      .run();
    console.error("Voice follow-up SMS failed.", sent.reason);
    return voiceXml("We could not send the text message. Please hang up and text this number directly.");
  }

  const messageCreatedAt = Date.now();
  const inserted = await db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
    .bind(call.request_id, "system", FOLLOW_UP_SMS, messageCreatedAt)
    .run();
  const messageId = Number(inserted.meta.last_row_id);
  if (messageId) {
    await recordTwilioDelivery(db, {
      sid: sent.sid,
      requestId: call.request_id,
      messageId,
      direction: "outbound_voice_follow_up",
      status: sent.status,
      createdAt: messageCreatedAt,
    });
  }
  await db.prepare("UPDATE twilio_voice_calls SET sms_follow_up_sent_at=?,updated_at=? WHERE call_sid=?")
    .bind(messageCreatedAt, messageCreatedAt, callSid)
    .run();

  return voiceXml("Thank you. Your text is on the way.");
}
