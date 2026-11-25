import { ACK_COOLDOWN_MS } from "@/lib/conversation-routing";
import { ensureDatabase, getBindings } from "@/lib/database";
import { siteConfig } from "@/lib/site-config";
import { sendTwilioMessage, validateTwilioRequest } from "@/lib/twilio";
import { callerPattern, callSidPattern, hashIntakeToken, quarantinedCaller, randomIntakeToken, speechCallback, spokenIntakeEnabled, voiceFallback, voiceXml } from "@/lib/voice-intake";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const webhook = getBindings().TWILIO_VOICE_WEBHOOK_URL;
  if (!webhook) return voiceXml("", 503);
  if (!await validateTwilioRequest(request, parameters, speechCallback(webhook))) return voiceXml("", 403);
  if (!spokenIntakeEnabled()) return voiceXml(voiceFallback());

  const sid = parameters.get("CallSid")?.trim() ?? "";
  const phone = parameters.get("From")?.trim() ?? "";
  if (!callSidPattern.test(sid) || !callerPattern.test(phone)) return voiceXml(voiceFallback());
  const speech = (parameters.get("SpeechResult") ?? "").trim();
  const confidence = Number(parameters.get("Confidence"));
  const now = Date.now();
  const accepted = /^yes[.!]?$/i.test(speech) && confidence >= 0.85 && confidence <= 1
    && !["completed", "canceled", "failed", "busy", "no-answer"].includes(parameters.get("CallStatus") ?? "");
  const db = await ensureDatabase();
  const recorded = await db.prepare(`UPDATE intake_calls SET answer=?,confidence=?,consented_at=?,empty_at=?
    WHERE sid=? AND phone=? AND prompt IS NOT NULL AND answer IS NULL AND empty_at IS NULL AND created_at>?`)
    .bind(accepted ? "yes" : "", Number.isFinite(confidence) ? confidence : null,
      accepted ? now : null, accepted ? null : now, sid, phone, now - 5 * 60_000).run();
  if (!accepted) return voiceXml(voiceFallback());
  if (!recorded.meta.changes) return voiceXml("<Hangup/>");
  if (await quarantinedCaller(db, phone, now)) return voiceXml(voiceFallback());

  const token = randomIntakeToken();
  const reserved = await db.prepare(`UPDATE intake_calls SET sms_reserved_at=?,token_hash=?,expires_at=?
    WHERE sid=? AND sms_reserved_at IS NULL
      AND COALESCE((SELECT opted_out FROM intake_sms_preferences WHERE phone=?),
        (SELECT opted_out_at IS NOT NULL FROM sms_consents WHERE phone_e164=? ORDER BY consented_at DESC LIMIT 1),0)=0
      AND NOT EXISTS (SELECT 1 FROM intake_calls WHERE phone=? AND sms_reserved_at>?)`)
    .bind(now, await hashIntakeToken(token), now + 7 * ACK_COOLDOWN_MS, sid, phone, phone, phone, now - ACK_COOLDOWN_MS).run();
  if (!reserved.meta.changes) return voiceXml(voiceFallback());
  try {
    const link = `${siteConfig.url}/intake/${token}`;
    const sent = await sendTwilioMessage(phone, `Anchor Point One: Thanks for calling. Please describe your RV issue using this short, no-obligation form: ${link}\nYou can add photos if helpful. We’ll respond as soon as possible. Reply STOP to opt out.`);
    return voiceXml(sent.ok ? "<Hangup/>" : voiceFallback());
  } catch {
    return voiceXml(voiceFallback());
  }
}
