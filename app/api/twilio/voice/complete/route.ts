import { ensureDatabase, getBindings } from "@/lib/database";
import { validateTwilioRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const voiceXml = (body: string, status = 200) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
  { status, headers: { "content-type": "text/xml; charset=utf-8" } },
);

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const callbackUrl = getBindings().TWILIO_VOICE_COMPLETE_WEBHOOK_URL;
  if (!callbackUrl) return voiceXml("", 503);
  if (!await validateTwilioRequest(request, parameters, callbackUrl)) return voiceXml("", 403);
  const callSid = parameters.get("CallSid")?.trim() ?? "";
  if (!/^CA[a-zA-Z0-9]{20,64}$/.test(callSid)) return voiceXml("", 400);
  const status = parameters.get("CallStatus") ?? "";
  if (["completed", "canceled", "failed", "busy", "no-answer"].includes(status)) {
    const db = await ensureDatabase();
    await db.prepare(`UPDATE intake_calls SET empty_at=? WHERE sid=? AND prompt IS NOT NULL
      AND answer IS NULL AND empty_at IS NULL`).bind(Date.now(), callSid).run();
  }
  return voiceXml("<Hangup/>");
}
