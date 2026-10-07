import { getAdminIdentity } from "@/lib/admin";
import { ensureDatabase, getBindings } from "@/lib/database";
import { requestReference } from "@/lib/request-reference";
import { jsonError } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Row = Record<string, string | number | null>;
type AttachmentRow = Row & { request_id: string; message_created_at: number };

export async function GET() {
  const admin = await getAdminIdentity();
  if (!admin) return jsonError("Owner access is required.", 403);
  const db = await ensureDatabase();
  const [reviews, requests, messages, attachments, deliveryStatuses] = await Promise.all([
    db.prepare("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 100").all<Row>(),
    db.prepare(`SELECT service_requests.*,
      request_preferences.preferred_contact_method,
      request_preferences.rv_details,
      request_preferences.equipment_model,
      request_preferences.appointment_preference,
      request_preferences.city,
      request_preferences.postal_code,
      request_preferences.rv_type,
      request_preferences.source_channel,
      MAX(
        service_requests.created_at,
        COALESCE((SELECT MAX(request_messages.created_at) FROM request_messages
          WHERE request_messages.request_id=service_requests.id AND request_messages.author_type='customer'),0),
        COALESCE((SELECT MAX(twilio_voice_calls.created_at) FROM twilio_voice_calls
          WHERE twilio_voice_calls.request_id=service_requests.id),0),
        COALESCE((SELECT MAX(twilio_message_events.created_at) FROM twilio_message_events
          WHERE twilio_message_events.request_id=service_requests.id AND twilio_message_events.direction LIKE 'inbound%'),0)
      ) AS last_inbound_at,
      CASE WHEN service_requests.owner_read_at IS NULL OR service_requests.owner_read_at < MAX(
        service_requests.created_at,
        COALESCE((SELECT MAX(request_messages.created_at) FROM request_messages
          WHERE request_messages.request_id=service_requests.id AND request_messages.author_type='customer'),0),
        COALESCE((SELECT MAX(twilio_voice_calls.created_at) FROM twilio_voice_calls
          WHERE twilio_voice_calls.request_id=service_requests.id),0),
        COALESCE((SELECT MAX(twilio_message_events.created_at) FROM twilio_message_events
          WHERE twilio_message_events.request_id=service_requests.id AND twilio_message_events.direction LIKE 'inbound%'),0)
      ) THEN 1 ELSE 0 END AS is_unread,
      CASE WHEN sms_consents.request_id IS NOT NULL AND sms_consents.opted_out_at IS NULL THEN 1 ELSE 0 END AS sms_enabled
      FROM service_requests
      LEFT JOIN request_preferences ON request_preferences.request_id=service_requests.id
      LEFT JOIN sms_consents ON sms_consents.request_id=service_requests.id
      ORDER BY service_requests.updated_at DESC LIMIT 100`).all<Row>(),
    db.prepare(`SELECT * FROM (
      SELECT request_messages.* FROM request_messages
      INNER JOIN (
        SELECT id FROM service_requests ORDER BY updated_at DESC LIMIT 100
      ) AS latest_requests ON latest_requests.id=request_messages.request_id
      ORDER BY request_messages.created_at DESC,request_messages.id DESC LIMIT 3000
    ) ORDER BY created_at,id`).all<Row>(),
    db.prepare(`SELECT * FROM (
      SELECT request_attachments.id,request_attachments.request_id,
        request_attachments.message_created_at,request_attachments.filename,
        request_attachments.content_type,request_attachments.size_bytes,
        request_attachments.created_at
      FROM request_attachments
      INNER JOIN (
        SELECT id FROM service_requests ORDER BY updated_at DESC LIMIT 100
      ) AS latest_requests ON latest_requests.id=request_attachments.request_id
      ORDER BY request_attachments.created_at DESC,request_attachments.id DESC LIMIT 3000
    ) ORDER BY created_at,id`).all<AttachmentRow>(),
    db.prepare(
      "SELECT message_id,status,error_code,updated_at FROM twilio_delivery_statuses WHERE message_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1000",
    ).all<Row>(),
  ]);
  const attachmentsByMessage = new Map<string, AttachmentRow[]>();
  for (const attachment of attachments.results) {
    const key = `${attachment.request_id}:${attachment.message_created_at}`;
    const group = attachmentsByMessage.get(key) ?? [];
    group.push(attachment);
    attachmentsByMessage.set(key, group);
  }
  const deliveryByMessage = new Map<number, Row>();
  for (const delivery of deliveryStatuses.results) {
    const messageId = Number(delivery.message_id);
    if (messageId && !deliveryByMessage.has(messageId)) deliveryByMessage.set(messageId, delivery);
  }
  const bindings = getBindings();
  const smsReady = Boolean(
    bindings.TWILIO_ACCOUNT_SID &&
    bindings.TWILIO_AUTH_TOKEN &&
    (bindings.TWILIO_MESSAGING_SERVICE_SID || bindings.TWILIO_FROM_NUMBER),
  );
  return Response.json({
    admin,
    reviews: reviews.results,
    requests: requests.results.map((item: Row) => ({
      ...item,
      reference: requestReference(String(item.id)),
    })),
    messages: messages.results.map((message: Row) => {
      const delivery = deliveryByMessage.get(Number(message.id));
      return {
        ...message,
        attachments: attachmentsByMessage.get(`${message.request_id}:${message.created_at}`) ?? [],
        sms_status: delivery?.status ?? null,
        sms_error_code: delivery?.error_code ?? null,
        sms_updated_at: delivery?.updated_at ?? null,
      };
    }),
    smsReady,
  }, {
    headers: { "cache-control": "private, no-store" },
  });
}
