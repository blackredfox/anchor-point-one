import { ensureDatabase, getBindings } from "@/lib/database";
import { validateTwilioRequest } from "@/lib/twilio";
import { callerPattern, callSidPattern, escapeXml, say, speechCallback, spokenIntakeEnabled, voiceFallback, voicePrompt, voicePromptVersion, voiceXml } from "@/lib/voice-intake";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const webhook = getBindings().TWILIO_VOICE_WEBHOOK_URL;
  if (!webhook) return voiceXml("", 503);
  if (!await validateTwilioRequest(request, parameters, webhook)) return voiceXml("", 403);

  const sid = parameters.get("CallSid")?.trim() ?? "";
  const from = parameters.get("From")?.trim() ?? "";
  if (!callSidPattern.test(sid)) return voiceXml("", 400);

  const phone = callerPattern.test(from) ? from : null;
  const speech = Boolean(phone && spokenIntakeEnabled());
  const db = await ensureDatabase();
  await db.prepare("INSERT OR IGNORE INTO intake_calls (sid,phone,created_at,prompt,prompt_version) VALUES (?,?,?,?,?)")
    .bind(sid, phone, Date.now(), speech ? voicePrompt : null, speech ? voicePromptVersion : null).run();
  if (!speech) return voiceXml(voiceFallback());

  const action = escapeXml(speechCallback(webhook));
  return voiceXml(`<Gather input="speech" language="en-US" timeout="4" speechTimeout="auto" actionOnEmptyResult="true" action="${action}" method="POST">${say(voicePrompt)}</Gather>${voiceFallback()}`);
}
