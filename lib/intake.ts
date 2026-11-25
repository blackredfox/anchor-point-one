import { phoneRequestId } from "@/lib/conversation-routing";
import { randomIntakeToken } from "@/lib/voice-intake";

export type IntakeRequest = {
  id: string;
  access_token: string;
};

export async function findIntakeRequest(db: D1Database, phone: string, reference?: string | null) {
  if (reference) {
    const explicit = await db.prepare(`SELECT id,access_token FROM service_requests
      WHERE phone=? AND UPPER(SUBSTR(id,1,8))=? ORDER BY updated_at DESC LIMIT 1`)
      .bind(phone, reference).first<IntakeRequest>();
    if (explicit) return explicit;
  }

  return db.prepare(`SELECT requests.id,requests.access_token FROM service_requests AS requests
    LEFT JOIN phone_conversations AS conversations ON conversations.phone_e164=requests.phone
    WHERE requests.phone=?
    ORDER BY (conversations.active_request_id=requests.id) DESC,requests.updated_at DESC,requests.id LIMIT 1`)
    .bind(phone).first<IntakeRequest>();
}

export async function prepareIntake(db: D1Database, input: {
  phone: string; name: string; description: string; source: "web" | "call_link" | "sms"; now: number;
  existing: IntakeRequest | null;
}) {
  const { phone, name, description, source, now, existing } = input;
  const id = existing?.id ?? await phoneRequestId(phone);
  const accessToken = randomIntakeToken();
  const create = db.prepare(`INSERT OR IGNORE INTO service_requests
    (id,access_token,customer_name,email,phone,address,service_type,description,status,created_at,updated_at)
    VALUES (?,?,?,'',?,'',?,?,'received',?,?)`)
    .bind(id, accessToken, name, phone, source === "call_link" ? "rv" : "not_sure", description, now, now);
  const preferences = db.prepare(`INSERT OR IGNORE INTO request_preferences
    (request_id,submission_key,preferred_contact_method,rv_details,equipment_model,appointment_preference,city,postal_code,rv_type,source_channel)
    VALUES (?,?,'text','','','','','','',?)`).bind(id, crypto.randomUUID(), source);
  const queue = db.prepare(`INSERT INTO intake_owner_notifications (request_id,channel,state)
    SELECT ?,channel,'pending' FROM (SELECT 'email' AS channel UNION ALL SELECT 'sms')
    WHERE EXISTS (SELECT 1 FROM service_requests WHERE id=? AND access_token=?)
    ON CONFLICT(request_id,channel) DO NOTHING`).bind(id, id, accessToken);
  const newRequest = existing ? [] : [create, queue, preferences];
  const link = db.prepare(`INSERT INTO phone_conversations (phone_e164,active_request_id,last_activity_at,last_ack_at)
    VALUES (?,?,?,NULL) ON CONFLICT(phone_e164) DO UPDATE SET
    active_request_id=excluded.active_request_id,last_activity_at=MAX(phone_conversations.last_activity_at,excluded.last_activity_at)`)
    .bind(phone, id, now);
  return { id, newRequest, link };
}

export function meaningfulSms(body: string) {
  const cleaned = body.replace(/\bAP-[A-F0-9]{8}\b/gi, "").trim();
  return !/https?:\/\/|www\./i.test(cleaned)
    && /\b(?:rv|power|battery|leak\w*|refrigerator|fridge|cool\w*|heat\w*|water|pump|toilet|microwave|furnace|slide\w*|awning|breaker|electric\w*|outlet|roof|propane|repair\w*|diagnos\w*|install\w*|fitting|door|light\w*|inverter|converter|generator|sink|shower|ac|air conditioner)\b/i.test(cleaned)
    && (cleaned.match(/\p{L}+/gu)?.length ?? 0) >= 2
    && /\b(?:no|not|never|without|bad|broken|stuck|dead|fail\w*|leak\w*|issue\w*|problem\w*|error\w*|need\w*|help|repair\w*|diagnos\w*|install\w*|replac\w*|won['’]?t|can['’]?t|stop\w*|smell\w*|noise|sparks?)\b/i.test(cleaned);
}
