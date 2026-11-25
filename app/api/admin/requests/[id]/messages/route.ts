import { getAdminIdentity } from "@/lib/admin";
import { ensureDatabase, getBindings } from "@/lib/database";
import { jsonError } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type MessageRow = { id: number; created_at: number };
async function processPendingAttachmentCleanup(db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const bucket = getBindings().BUCKET;
  if (bucket) {
    const queued = await db.prepare(`SELECT attachment_id,object_key FROM attachment_cleanup_queue
      ORDER BY queued_at LIMIT 100`).all<{ attachment_id: string; object_key: string }>();
    if (queued.results.length) {
      try {
        await bucket.delete(queued.results.map((item: { object_key: string }) => item.object_key));
        await db.prepare("DELETE FROM attachment_cleanup_queue WHERE attachment_id IN (SELECT value FROM json_each(?))")
          .bind(JSON.stringify(queued.results.map((item: { attachment_id: string }) => item.attachment_id))).run();
      } catch (error) {
        console.error("Message attachment cleanup failed.", error instanceof Error ? error.name : "UnknownError");
      }
    }
  }
  const pending = await db.prepare("SELECT 1 FROM attachment_cleanup_queue LIMIT 1").first();
  return pending ? "pending" : "complete";
}

export async function POST() {
  if (!await getAdminIdentity()) return jsonError("Owner access is required.", 403);
  const db = await ensureDatabase();
  return Response.json({ attachmentCleanup: await processPendingAttachmentCleanup(db) });
}

function messageIds(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 50_000) return null;
  const ids = [...new Set(value)];
  return ids.every((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)
    ? ids as number[]
    : null;
}

export async function GET(_request: Request, { params }: Context) {
  if (!await getAdminIdentity()) return jsonError("Owner access is required.", 403);
  const { id } = await params;
  const db = await ensureDatabase();
  const messages = await db.prepare("SELECT id FROM request_messages WHERE request_id=? ORDER BY id LIMIT 50001")
    .bind(id).all<{ id: number }>();
  if (messages.results.length > 50_000) return jsonError("This conversation is too large for one deletion. Select smaller groups.", 413);
  return Response.json({ messageIds: messages.results.map((message: { id: number }) => message.id) }, {
    headers: { "cache-control": "private, no-store" },
  });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!await getAdminIdentity()) return jsonError("Owner access is required.", 403);
  const { id } = await params;
  let value: { messageIds?: unknown };
  try {
    value = await request.json() as { messageIds?: unknown };
  } catch {
    return jsonError("Choose one or more messages to delete.");
  }
  const ids = messageIds(value?.messageIds);
  if (!ids) return jsonError("Choose one or more valid messages to delete.");

  const db = await ensureDatabase();
  await processPendingAttachmentCleanup(db);
  const requestItem = await db.prepare("SELECT id FROM service_requests WHERE id=?").bind(id).first<{ id: string }>();
  if (!requestItem) return jsonError("Request not found.", 404);

  const messages = await db.prepare(
    "SELECT id,created_at FROM request_messages WHERE request_id=? AND id IN (SELECT value FROM json_each(?))",
  ).bind(id, JSON.stringify(ids)).all<MessageRow>();
  if (messages.results.length !== ids.length) {
    return jsonError("One or more messages are no longer in this request. Refresh and try again.", 409);
  }

  const createdAtValues = [...new Set(messages.results.map((message: MessageRow) => message.created_at))];
  const encodedCreatedAtValues = JSON.stringify(createdAtValues);
  const messagesAtSelectedTimes = await db.prepare(
    "SELECT id FROM request_messages WHERE request_id=? AND created_at IN (SELECT value FROM json_each(?))",
  ).bind(id, encodedCreatedAtValues).all<{ id: number }>();
  const selected = new Set(ids);
  if (messagesAtSelectedTimes.results.some((message: { id: number }) => !selected.has(message.id))) {
    return jsonError("One or more selected messages share an attachment timestamp. Select every message from that moment and try again.", 409);
  }
  const results = await db.batch([
    db.prepare(`INSERT OR REPLACE INTO attachment_cleanup_queue
      (attachment_id,object_key,filename,content_type,size_bytes,queued_at)
      SELECT attachment.id,attachment.object_key,attachment.filename,attachment.content_type,attachment.size_bytes,?
      FROM request_attachments AS attachment
      WHERE attachment.request_id=?
        AND attachment.message_created_at IN (SELECT value FROM json_each(?))
        AND NOT EXISTS (
          SELECT 1 FROM request_messages AS other
          WHERE other.request_id=attachment.request_id
            AND other.created_at=attachment.message_created_at
            AND other.id NOT IN (SELECT value FROM json_each(?))
        )`).bind(Date.now(), id, encodedCreatedAtValues, JSON.stringify(ids)),
    db.prepare("DELETE FROM twilio_delivery_statuses WHERE message_id IN (SELECT value FROM json_each(?))")
      .bind(JSON.stringify(ids)),
    db.prepare(`DELETE FROM request_attachments
      WHERE request_id=?
        AND message_created_at IN (SELECT value FROM json_each(?))
        AND NOT EXISTS (
          SELECT 1 FROM request_messages AS other
          WHERE other.request_id=request_attachments.request_id
            AND other.created_at=request_attachments.message_created_at
            AND other.id NOT IN (SELECT value FROM json_each(?))
        )`).bind(id, encodedCreatedAtValues, JSON.stringify(ids)),
    db.prepare("DELETE FROM request_messages WHERE request_id=? AND id IN (SELECT value FROM json_each(?))")
      .bind(id, JSON.stringify(ids)),
  ]);

  return Response.json({
    ok: true,
    deletedCount: Number(results.at(-1)?.meta.changes ?? 0),
    attachmentCleanup: await processPendingAttachmentCleanup(db),
  });
}
