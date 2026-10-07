export const ACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function phoneRequestId(phone: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`anchor-point-one:${phone}`),
  );
  const hex = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function extractRequestReference(body: string) {
  return body.match(/\bAP-([A-F0-9]{8})\b/i)?.[1]?.toUpperCase() ?? null;
}

export function selectConversationItem<T>(candidates: {
  referencedItem: T | null;
  activeItem: T | null;
  eventItem: T | null;
  previousRequest: T | null;
}) {
  return candidates.referencedItem ?? candidates.activeItem ?? candidates.eventItem ?? candidates.previousRequest;
}

export function shouldAutoAcknowledge(now: number, lastActivityAt: number, lastAckAt: number) {
  const inactiveLongEnough = !lastActivityAt || now - lastActivityAt >= ACK_COOLDOWN_MS;
  const ackCooldownPassed = !lastAckAt || now - lastAckAt >= ACK_COOLDOWN_MS;
  return inactiveLongEnough && ackCooldownPassed;
}
