import { getBindings } from "@/lib/database";

type TwilioSendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; reason: "not_configured" | "failed" };

export async function sendTwilioMessage(
  to: string,
  body: string,
): Promise<TwilioSendResult> {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    TWILIO_MESSAGING_SERVICE_SID,
    TWILIO_STATUS_WEBHOOK_URL,
  } = getBindings();

  if (
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_AUTH_TOKEN ||
    (!TWILIO_FROM_NUMBER && !TWILIO_MESSAGING_SERVICE_SID)
  ) {
    return { ok: false, reason: "not_configured" };
  }

  const form = new URLSearchParams({ To: to, Body: body });
  if (TWILIO_MESSAGING_SERVICE_SID) {
    form.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  } else if (TWILIO_FROM_NUMBER) {
    form.set("From", TWILIO_FROM_NUMBER);
  }
  if (TWILIO_STATUS_WEBHOOK_URL) {
    form.set("StatusCallback", TWILIO_STATUS_WEBHOOK_URL);
  }

  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );

  if (!response.ok) {
    console.error("Twilio message send failed.", response.status);
    return { ok: false, reason: "failed" };
  }

  const data = await response.json() as { sid?: string; status?: string };
  if (!data.sid) return { ok: false, reason: "failed" };
  return { ok: true, sid: data.sid, status: data.status || "accepted" };
}

export async function recordTwilioDelivery(
  db: D1Database,
  value: {
    sid: string;
    requestId: string;
    messageId: number;
    direction: string;
    status: string;
    createdAt: number;
  },
) {
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO twilio_message_events (sid,request_id,direction,created_at) VALUES (?,?,?,?)")
      .bind(value.sid, value.requestId, value.direction, value.createdAt),
    db.prepare(`INSERT INTO twilio_delivery_statuses
      (sid,request_id,message_id,status,error_code,updated_at) VALUES (?,?,?,?,NULL,?)
      ON CONFLICT(sid) DO UPDATE SET
        request_id=COALESCE(twilio_delivery_statuses.request_id,excluded.request_id),
        message_id=COALESCE(twilio_delivery_statuses.message_id,excluded.message_id),
        updated_at=MAX(twilio_delivery_statuses.updated_at,excluded.updated_at)`)
      .bind(value.sid, value.requestId, value.messageId, value.status, value.createdAt),
  ]);
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function validateTwilioRequest(
  request: Request,
  parameters: URLSearchParams,
  expectedUrl?: string,
) {
  const { TWILIO_AUTH_TOKEN, TWILIO_WEBHOOK_URL } = getBindings();
  const signature = request.headers.get("x-twilio-signature");
  if (!TWILIO_AUTH_TOKEN || !signature) return false;

  const url = expectedUrl || TWILIO_WEBHOOK_URL || request.url;
  const sorted = Array.from(new Set(parameters.keys())).sort();
  let payload = url;
  for (const key of sorted) {
    for (const value of parameters.getAll(key)) payload += `${key}${value}`;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return constantTimeEqual(expected, signature);
}

export async function deleteTwilioRecording(recordingSid: string) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = getBindings();
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !/^RE[a-zA-Z0-9]{20,64}$/.test(recordingSid)) {
    return false;
  }
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Recordings/${encodeURIComponent(recordingSid)}.json`,
    { method: "DELETE", headers: { authorization: `Basic ${credentials}` } },
  );
  if (!response.ok && response.status !== 404) {
    console.error("Stored Twilio recording could not be deleted.", response.status);
    return false;
  }
  return true;
}
