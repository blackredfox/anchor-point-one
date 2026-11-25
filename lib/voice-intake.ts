import { ACK_COOLDOWN_MS } from "@/lib/conversation-routing";
import { getBindings } from "@/lib/database";

export const voicePrompt = "Thank you for calling Anchor Point One. We’re currently working with a customer. If you’d like us to text you a short, no-obligation service request form, please say ‘yes’.";
export const voicePromptVersion = "spoken-intake-v1";
const fallback = "Thank you. Please visit anchorpoint.help when convenient to send a short service request. There is no obligation.";
export const callSidPattern = /^CA[a-zA-Z0-9]{20,64}$/;
export const callerPattern = /^\+1\d{10}$/;

export const spokenIntakeEnabled = () => getBindings().TWILIO_SPOKEN_INTAKE_ENABLED === "true";
export const speechCallback = (webhook: string) => new URL("/api/twilio/voice/sms-follow-up", webhook).href;
export const say = (value: string) => `<Say voice="Polly.Joanna" language="en-US">${escapeXml(value)}</Say>`;
export const voiceFallback = () => `${say(fallback)}<Hangup/>`;
export const voiceXml = (body = "", status = 200) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
  { status, headers: { "content-type": "text/xml; charset=utf-8" } },
);

export function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function randomIntakeToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashIntakeToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const unansweredCallCondition = `(
  calls.empty_at IS NOT NULL OR calls.created_at<=?
) AND NOT EXISTS (
  SELECT 1 FROM intake_form_submissions AS forms JOIN service_requests AS requests ON requests.id=forms.request_id
  WHERE requests.phone=calls.phone AND forms.created_at BETWEEN calls.created_at AND calls.created_at+?
) AND NOT EXISTS (
  SELECT 1 FROM intake_message_events AS messages
  WHERE messages.phone=calls.phone AND messages.kind='accepted'
    AND messages.created_at BETWEEN calls.created_at AND calls.created_at+?
)`;

export async function quarantinedCaller(db: D1Database, phone: string, now: number) {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM intake_calls AS calls
    WHERE calls.phone=? AND calls.created_at>? AND ${unansweredCallCondition}`)
    .bind(phone, now - 7 * ACK_COOLDOWN_MS, now - ACK_COOLDOWN_MS, ACK_COOLDOWN_MS, ACK_COOLDOWN_MS)
    .first<{ count: number }>();
  return Number(row?.count ?? 0) >= 3;
}
