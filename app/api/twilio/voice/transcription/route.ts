import { ensureDatabase, getBindings } from "@/lib/database";
import { sendVoicemailTranscriptionNotification } from "@/lib/notifications";
import { deleteTwilioRecording, validateTwilioRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

type VoiceCall = {
  call_sid: string;
  request_id: string;
  from_phone: string;
  transcription_text: string | null;
  transcription_notified_at: number | null;
};

const empty = (status = 204) => new Response(null, { status });

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const bindings = getBindings();
  const callbackUrl = bindings.TWILIO_TRANSCRIPTION_WEBHOOK_URL;
  if (!callbackUrl || bindings.TWILIO_VOICEMAIL_TRANSCRIPTION_ENABLED !== "true") return empty(503);
  if (!await validateTwilioRequest(request, parameters, callbackUrl)) return empty(403);

  const recordingSid = parameters.get("RecordingSid")?.trim() ?? "";
  const status = parameters.get("TranscriptionStatus")?.trim().toLowerCase() ?? "";
  const transcription = parameters.get("TranscriptionText")?.trim() ?? "";
  if (
    !/^RE[a-zA-Z0-9]{20,64}$/.test(recordingSid) ||
    !["completed", "failed"].includes(status) ||
    transcription.length > 8_000
  ) {
    return empty(400);
  }
  const db = await ensureDatabase();
  let item = await db.prepare("SELECT call_sid,request_id,from_phone,transcription_text,transcription_notified_at FROM twilio_voice_calls WHERE recording_sid=?")
    .bind(recordingSid)
    .first<VoiceCall>();
  if (!item) return empty(409);

  if (status === "completed" && transcription && !item.transcription_text) {
    const now = Date.now();
    await db.batch([
      db.prepare("UPDATE twilio_voice_calls SET transcription_text=?,updated_at=? WHERE call_sid=? AND transcription_text IS NULL")
        .bind(transcription, now, item.call_sid),
      db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
        .bind(item.request_id, "system", `Voicemail transcription:\n${transcription}`, now),
      db.prepare("UPDATE service_requests SET updated_at=? WHERE id=?").bind(now, item.request_id),
    ]);
    item = { ...item, transcription_text: transcription };
  }
  if (status === "completed" && transcription && !item.transcription_notified_at) {
    const sent = await sendVoicemailTranscriptionNotification({
      requestId: item.request_id,
      phone: item.from_phone,
      transcription,
      origin: new URL(request.url).origin,
    }).catch(() => "failed" as const);
    if (sent === "sent") {
      await db.prepare("UPDATE twilio_voice_calls SET transcription_notified_at=?,updated_at=? WHERE call_sid=? AND transcription_notified_at IS NULL")
        .bind(Date.now(), Date.now(), item.call_sid)
        .run();
    }
  }
  await deleteTwilioRecording(recordingSid);
  return empty();
}
