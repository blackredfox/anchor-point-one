import { removeStoredAttachments, storeTwilioRecording } from "@/lib/attachments";
import { ensureDatabase, getBindings } from "@/lib/database";
import { sendMissedCallNotification, sendVoicemailNotification } from "@/lib/notifications";
import { deleteTwilioRecording, validateTwilioRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

type VoiceCall = {
  request_id: string;
  from_phone: string;
  recording_status: string;
  recording_attachment_id: string | null;
  notification_sent_at: number | null;
};

const empty = (status = 204) => new Response(null, { status });

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const bindings = getBindings();
  const callbackUrl = bindings.TWILIO_RECORDING_WEBHOOK_URL;
  if (!callbackUrl) return empty(503);
  if (!await validateTwilioRequest(request, parameters, callbackUrl)) return empty(403);

  const callSid = parameters.get("CallSid")?.trim() ?? "";
  const status = parameters.get("RecordingStatus")?.trim().toLowerCase() ?? "";
  if (!/^CA[a-zA-Z0-9]{20,64}$/.test(callSid) || !["completed", "absent"].includes(status)) {
    return empty(400);
  }
  const db = await ensureDatabase();
  let item = await db.prepare("SELECT request_id,from_phone,recording_status,recording_attachment_id,notification_sent_at FROM twilio_voice_calls WHERE call_sid=?")
    .bind(callSid)
    .first<VoiceCall>();
  if (!item) return empty(409);
  const origin = new URL(request.url).origin;
  const now = Date.now();

  if (status === "absent") {
    const reserved = await db.prepare(`UPDATE twilio_voice_calls
      SET recording_status='absent',updated_at=?
      WHERE call_sid=? AND recording_status NOT IN ('absent','stored')`)
      .bind(now, callSid)
      .run();
    if (reserved.meta.changes) {
      await db.batch([
        db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
          .bind(item.request_id, "system", "Incoming call ended without a voicemail.", now),
        db.prepare("UPDATE service_requests SET status=CASE WHEN status IN ('completed','closed') THEN 'in_review' ELSE status END,updated_at=? WHERE id=?")
          .bind(now, item.request_id),
      ]);
    }
    item = await db.prepare("SELECT request_id,from_phone,recording_status,recording_attachment_id,notification_sent_at FROM twilio_voice_calls WHERE call_sid=?")
      .bind(callSid)
      .first<VoiceCall>() ?? item;
    if (!item.notification_sent_at) {
      const sent = await sendMissedCallNotification({
        requestId: item.request_id,
        phone: item.from_phone,
        origin,
      }).catch(() => "failed" as const);
      if (sent === "sent") {
        await db.prepare("UPDATE twilio_voice_calls SET notification_sent_at=?,updated_at=? WHERE call_sid=? AND notification_sent_at IS NULL")
          .bind(Date.now(), Date.now(), callSid)
          .run();
      }
    }
    return empty();
  }

  const recordingSid = parameters.get("RecordingSid")?.trim() ?? "";
  const recordingUrl = parameters.get("RecordingUrl")?.trim() ?? "";
  const duration = Number(parameters.get("RecordingDuration") ?? "0");
  if (
    !/^RE[a-zA-Z0-9]{20,64}$/.test(recordingSid) ||
    !recordingUrl ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > 119
  ) {
    return empty(400);
  }

  if (item.recording_status !== "stored") {
    const reserved = await db.prepare(`UPDATE twilio_voice_calls
      SET recording_status='processing',recording_sid=?,updated_at=?
      WHERE call_sid=? AND recording_status NOT IN ('processing','stored')`)
      .bind(recordingSid, now, callSid)
      .run();
    if (!reserved.meta.changes) return empty();

    let stored: Awaited<ReturnType<typeof storeTwilioRecording>> | null = null;
    try {
      stored = await storeTwilioRecording(item.request_id, recordingSid, recordingUrl);
      await db.batch([
        db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
          .bind(item.request_id, "customer", "Voicemail recording received.", now),
        db.prepare("INSERT INTO request_attachments (id,request_id,message_created_at,author_type,object_key,filename,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(stored.id, item.request_id, now, "customer", stored.objectKey, stored.filename, stored.contentType, stored.sizeBytes, now),
        db.prepare(`UPDATE twilio_voice_calls SET recording_status='stored',recording_sid=?,
          recording_attachment_id=?,updated_at=? WHERE call_sid=?`)
          .bind(recordingSid, stored.id, now, callSid),
        db.prepare("UPDATE service_requests SET status=CASE WHEN status IN ('received','completed','closed') THEN 'in_review' ELSE status END,updated_at=? WHERE id=?")
          .bind(now, item.request_id),
      ]);
    } catch (error) {
      if (stored) await removeStoredAttachments([stored]);
      await db.prepare("UPDATE twilio_voice_calls SET recording_status='failed',updated_at=? WHERE call_sid=?")
        .bind(Date.now(), callSid)
        .run();
      console.error("Voicemail recording could not be stored.", error instanceof Error ? error.name : "UnknownError");
      return empty(500);
    }
    item = { ...item, recording_status: "stored", recording_attachment_id: stored.id };
  }

  if (!item.notification_sent_at) {
    const sent = await sendVoicemailNotification({
      requestId: item.request_id,
      phone: item.from_phone,
      durationSeconds: Math.round(duration),
      origin,
    }).catch(() => "failed" as const);
    if (sent === "sent") {
      await db.prepare("UPDATE twilio_voice_calls SET notification_sent_at=?,updated_at=? WHERE call_sid=? AND notification_sent_at IS NULL")
        .bind(Date.now(), Date.now(), callSid)
        .run();
    }
  }
  if (bindings.TWILIO_VOICEMAIL_TRANSCRIPTION_ENABLED !== "true") {
    await deleteTwilioRecording(recordingSid);
  }
  return empty();
}
