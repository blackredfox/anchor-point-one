import { getAdminIdentity } from "@/lib/admin";
import { removeStoredAttachments, type StoredAttachment } from "@/lib/attachments";
import { ensureDatabase } from "@/lib/database";
import { sendCustomerReplyEmail } from "@/lib/notifications";
import { requestReference } from "@/lib/request-reference";
import { recordTwilioDelivery, sendTwilioMessage } from "@/lib/twilio";
import { choiceField, jsonError, textField } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const statuses = ["received", "in_review", "scheduled", "completed", "closed"] as const;

export async function POST(request: Request, { params }: Context) {
  if (!await getAdminIdentity()) return jsonError("Owner access is required.", 403);
  const { id } = await params;
  let value: Record<string, unknown>;
  try {
    value = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Enter a message.");
  }
  const body = textField(value.body, "Message", 1, 1500);
  if (!body.ok) return jsonError(body.message);
  const db = await ensureDatabase();
  const item = await db.prepare(`SELECT service_requests.phone,service_requests.email,
      service_requests.customer_name,service_requests.access_token,
      request_preferences.preferred_contact_method,
      CASE WHEN sms_consents.request_id IS NOT NULL AND sms_consents.opted_out_at IS NULL THEN 1 ELSE 0 END AS sms_enabled
    FROM service_requests
    LEFT JOIN request_preferences ON request_preferences.request_id=service_requests.id
    LEFT JOIN sms_consents ON sms_consents.request_id=service_requests.id
    WHERE service_requests.id=?`)
    .bind(id)
    .first<{
      phone: string;
      email: string;
      customer_name: string;
      access_token: string;
      preferred_contact_method: "text" | "email" | null;
      sms_enabled: number;
    }>();
  if (!item) return jsonError("Request not found.", 404);

  const now = Date.now();
  const preferredContact = item.preferred_contact_method ?? (item.sms_enabled ? "text" : item.email ? "email" : "web");
  if (preferredContact === "text" && item.sms_enabled) {
    const outgoing = `AnchorPoint (${requestReference(id)}): ${body.data}\nReply STOP to unsubscribe.`;
    const sent = await sendTwilioMessage(item.phone, outgoing);
    if (!sent.ok) {
      if (!item.email) {
        return jsonError(
          sent.reason === "not_configured"
            ? "SMS connection is not configured and no fallback email is available. The reply was not posted."
            : "SMS could not be accepted and no fallback email is available. The reply was not posted. Try again.",
          503,
        );
      }
    } else {
      const inserted = await db.prepare(
        "INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)",
      ).bind(id, "owner", body.data, now).run();
      const messageId = Number(inserted.meta.last_row_id);
      if (!messageId) return jsonError("The reply could not be recorded. Try again.", 500);
      await recordTwilioDelivery(db, {
        sid: sent.sid,
        requestId: id,
        messageId,
        direction: "outbound",
        status: sent.status,
        createdAt: now,
      });
      await db.prepare(`INSERT INTO phone_conversations (phone_e164,active_request_id,last_activity_at,last_ack_at)
        VALUES (?,?,?,NULL) ON CONFLICT(phone_e164) DO UPDATE SET
        active_request_id=excluded.active_request_id,last_activity_at=excluded.last_activity_at`)
        .bind(item.phone, id, now)
        .run();
      await db.prepare("UPDATE service_requests SET status=CASE WHEN status='received' THEN 'in_review' ELSE status END,updated_at=? WHERE id=?")
        .bind(now, id)
        .run();
      return Response.json({ ok: true, channel: "sms", smsStatus: sent.status }, { status: 201 });
    }
  }

  await db.batch([
    db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
      .bind(id, "owner", body.data, now),
    db.prepare("UPDATE service_requests SET status=CASE WHEN status='received' THEN 'in_review' ELSE status END,updated_at=? WHERE id=?")
      .bind(now, id),
  ]);
  if (item.email) {
    const emailStatus = await sendCustomerReplyEmail({
      email: item.email,
      name: item.customer_name,
      body: body.data,
      requestId: id,
      accessToken: item.access_token,
      origin: new URL(request.url).origin,
    }).catch((error) => {
      console.error(
        "Customer reply email failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return "failed" as const;
    });
    return Response.json({ ok: true, channel: "email", emailStatus }, { status: 201 });
  }

  return Response.json({ ok: true, channel: "web" }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Context) {
  if (!await getAdminIdentity()) return jsonError("Owner access is required.", 403);
  const { id } = await params;
  let value: Record<string, unknown>;
  try {
    value = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Choose a valid request update.");
  }
  const db = await ensureDatabase();
  let result;
  if (typeof value.status === "string") {
    const status = choiceField(value.status, statuses, "status");
    if (!status.ok) return jsonError(status.message);
    result = await db.prepare(
      "UPDATE service_requests SET status=?,updated_at=? WHERE id=?",
    ).bind(status.data, Date.now(), id).run();
  } else if (typeof value.isImportant === "boolean") {
    result = await db.prepare(
      "UPDATE service_requests SET is_important=? WHERE id=?",
    ).bind(value.isImportant ? 1 : 0, id).run();
  } else if (value.readState === "read" || value.readState === "unread") {
    result = value.readState === "read"
      ? await db.prepare("UPDATE service_requests SET owner_read_at=? WHERE id=?").bind(Date.now(), id).run()
      : await db.prepare("UPDATE service_requests SET owner_read_at=NULL WHERE id=?").bind(id).run();
  } else {
    return jsonError("Choose a valid request update.");
  }
  return result.meta.changes
    ? Response.json({ ok: true })
    : jsonError("Request not found.", 404);
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!await getAdminIdentity()) return jsonError("Owner access is required.", 403);
  const { id } = await params;
  const db = await ensureDatabase();
  const item = await db.prepare("SELECT id FROM service_requests WHERE id=?").bind(id).first<{ id: string }>();
  if (!item) return jsonError("Request not found.", 404);
  const attachmentRows = await db.prepare(
    "SELECT id,object_key,filename,content_type,size_bytes FROM request_attachments WHERE request_id=?",
  ).bind(id).all<Record<string, string | number>>();
  await db.batch([
    db.prepare("DELETE FROM twilio_delivery_statuses WHERE request_id=?").bind(id),
    db.prepare("DELETE FROM service_requests WHERE id=?").bind(id),
  ]);
  const stored = attachmentRows.results.map((row): StoredAttachment => ({
    id: String(row.id),
    objectKey: String(row.object_key),
    filename: String(row.filename),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes),
  }));
  try {
    await removeStoredAttachments(stored);
  } catch (error) {
    console.error("Request attachment cleanup failed after deletion.", error instanceof Error ? error.name : "UnknownError");
  }
  return Response.json({ ok: true });
}
