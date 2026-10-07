import { ensureDatabase, getBindings } from "@/lib/database";
import { validateTwilioRequest } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const knownStatuses = new Set([
  "accepted",
  "scheduled",
  "queued",
  "sending",
  "sent",
  "delivered",
  "undelivered",
  "failed",
  "read",
  "canceled",
]);

export async function POST(request: Request) {
  const parameters = new URLSearchParams(await request.text());
  const callbackUrl = getBindings().TWILIO_STATUS_WEBHOOK_URL;
  if (!callbackUrl || !await validateTwilioRequest(request, parameters, callbackUrl)) {
    return new Response(null, { status: 403 });
  }

  const sid = parameters.get("MessageSid")?.trim() ?? "";
  const status = parameters.get("MessageStatus")?.trim().toLowerCase() ?? "";
  const rawErrorCode = parameters.get("ErrorCode")?.trim() ?? "";
  const errorCode = /^\d{5}$/.test(rawErrorCode) ? rawErrorCode : null;
  if (!/^SM[a-zA-Z0-9]{20,64}$/.test(sid) || !knownStatuses.has(status)) {
    return new Response(null, { status: 400 });
  }

  const db = await ensureDatabase();
  await db.prepare(`INSERT INTO twilio_delivery_statuses
    (sid,request_id,message_id,status,error_code,updated_at) VALUES (?,NULL,NULL,?,?,?)
    ON CONFLICT(sid) DO UPDATE SET
      status=excluded.status,
      error_code=excluded.error_code,
      updated_at=excluded.updated_at`)
    .bind(sid, status, errorCode, Date.now())
    .run();
  return new Response(null, { status: 204 });
}
