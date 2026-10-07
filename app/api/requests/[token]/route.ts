import {
  MAX_PHOTOS,
  MAX_UPLOAD_BYTES,
  MAX_VIDEOS,
  removeStoredAttachments,
  storeAttachmentUploads,
} from "@/lib/attachments";
import { ensureDatabase } from "@/lib/database";
import { sendRequestChatNotification } from "@/lib/notifications";
import { requestReference } from "@/lib/request-reference";
import { jsonError } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };

type AttachmentRow = {
  id: string;
  message_created_at: number;
  filename: string;
  content_type: string;
  size_bytes: number;
};

function attachmentBody(photoCount: number, videoCount: number) {
  const parts = [];
  if (photoCount) parts.push(photoCount === 1 ? "Photo attached." : `${photoCount} photos attached.`);
  if (videoCount) parts.push("Short video attached.");
  return parts.join(" ");
}

export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  if (!/^[a-f0-9]{48}$/.test(token)) return jsonError("Request not found.", 404);
  const db = await ensureDatabase();
  const item = await db.prepare(
    "SELECT id,customer_name,service_type,description,status,created_at,updated_at FROM service_requests WHERE access_token=?",
  ).bind(token).first<Record<string, string | number>>();
  if (!item) return jsonError("Request not found.", 404);

  const [messageRows, attachmentRows] = await Promise.all([
    db.prepare(
      "SELECT id,author_type,body,created_at FROM request_messages WHERE request_id=? ORDER BY created_at,id",
    ).bind(item.id).all<Record<string, string | number>>(),
    db.prepare(
      "SELECT id,message_created_at,filename,content_type,size_bytes FROM request_attachments WHERE request_id=? ORDER BY created_at,id",
    ).bind(item.id).all<AttachmentRow>(),
  ]);
  const attachmentsByTime = new Map<number, AttachmentRow[]>();
  for (const attachment of attachmentRows.results) {
    const group = attachmentsByTime.get(attachment.message_created_at) ?? [];
    group.push(attachment);
    attachmentsByTime.set(attachment.message_created_at, group);
  }

  return Response.json({
    request: {
      reference: requestReference(String(item.id)),
      customerName: item.customer_name,
      serviceType: item.service_type,
      description: item.description,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    },
    messages: messageRows.results.map((message: Record<string, string | number>) => ({
      id: message.id,
      authorType: message.author_type,
      body: message.body,
      createdAt: message.created_at,
      attachments: (attachmentsByTime.get(Number(message.created_at)) ?? []).map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        sizeBytes: attachment.size_bytes,
      })),
    })),
  }, {
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request, context: Context) {
  const { token } = await context.params;
  if (!/^[a-f0-9]{48}$/.test(token)) return jsonError("Request not found.", 404);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 100_000) {
    return jsonError("The selected files are too large. Upload up to 30 MB at a time.", 413);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let rawBody = "";
  let attachmentValues: FormDataEntryValue[] = [];
  let rawMessageId = "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      rawBody = String(form.get("body") ?? "");
      attachmentValues = [...form.getAll("photos"), ...form.getAll("attachments")];
      rawMessageId = String(form.get("messageId") ?? "");
    } else {
      const value = await request.json() as Record<string, unknown>;
      rawBody = typeof value.body === "string" ? value.body : "";
    }
  } catch {
    return jsonError("Enter a message or choose a photo.");
  }

  const body = rawBody.trim();
  const files = attachmentValues.filter((value): value is File => value instanceof File && value.size > 0);
  const hasAttachments = files.length > 0;
  const messageId = /^\d+$/.test(rawMessageId) ? Number(rawMessageId) : null;
  if (rawMessageId && (!messageId || !Number.isSafeInteger(messageId))) {
    return jsonError("This photo group is no longer valid. Refresh and try again.");
  }
  if (files.length > 1) {
    return jsonError("Upload files one at a time.");
  }
  if (!body && !hasAttachments) return jsonError("Enter a message or choose a photo or short video.");
  if (messageId && body) return jsonError("Add retry files without a new message.");
  if (body.length > 2000) return jsonError("Message must be 2,000 characters or fewer.");

  const db = await ensureDatabase();
  const item = await db.prepare("SELECT id,customer_name FROM service_requests WHERE access_token=?")
    .bind(token)
    .first<{ id: string; customer_name: string }>();
  if (!item) return jsonError("Request not found.", 404);

  let stored = [] as Awaited<ReturnType<typeof storeAttachmentUploads>>;
  try {
    if (messageId) {
      const existing = await db.prepare(
        "SELECT id,body,created_at FROM request_messages WHERE id=? AND request_id=? AND author_type='customer'",
      ).bind(messageId, item.id).first<{ id: number; body: string; created_at: number }>();
      if (!existing) return jsonError("This photo group is no longer valid. Refresh and try again.", 404);

      const countRow = await db.prepare(`SELECT
          SUM(CASE WHEN content_type LIKE 'image/%' THEN 1 ELSE 0 END) AS photo_count,
          SUM(CASE WHEN content_type LIKE 'video/%' THEN 1 ELSE 0 END) AS video_count
        FROM request_attachments WHERE request_id=? AND message_created_at=?`)
        .bind(item.id, existing.created_at)
        .first<{ photo_count: number | null; video_count: number | null }>();
      const existingPhotos = Number(countRow?.photo_count ?? 0);
      const existingVideos = Number(countRow?.video_count ?? 0);
      const incomingVideo = files[0]?.type.startsWith("video/") ?? false;
      if (!incomingVideo && existingPhotos >= MAX_PHOTOS) return jsonError(`Upload up to ${MAX_PHOTOS} photos in one message.`);
      if (incomingVideo && existingVideos >= MAX_VIDEOS) return jsonError("Upload one short video in one message.");

      stored = await storeAttachmentUploads(item.id, attachmentValues);
      const now = Date.now();
      const totalPhotos = existingPhotos + stored.filter((item) => item.contentType.startsWith("image/")).length;
      const totalVideos = existingVideos + stored.filter((item) => item.contentType.startsWith("video/")).length;
      if (totalPhotos > MAX_PHOTOS) throw new Error(`Upload up to ${MAX_PHOTOS} photos in one message.`);
      if (totalVideos > MAX_VIDEOS) throw new Error("Upload one short video in one message.");
      const automaticBody = /^(?:(?:Photo|\d+ photos|Short video) attached\.\s*)+$/.test(existing.body);
      const updatedBody = automaticBody
        ? attachmentBody(totalPhotos, totalVideos)
        : existing.body;
      await db.batch([
        ...stored.map((attachment) =>
          db.prepare(
            "INSERT INTO request_attachments (id,request_id,message_created_at,author_type,object_key,filename,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          ).bind(
            attachment.id,
            item.id,
            existing.created_at,
            "customer",
            attachment.objectKey,
            attachment.filename,
            attachment.contentType,
            attachment.sizeBytes,
            now,
          )
        ),
        db.prepare("UPDATE request_messages SET body=? WHERE id=? AND request_id=?")
          .bind(updatedBody, messageId, item.id),
        db.prepare("UPDATE service_requests SET status=CASE WHEN status IN ('received','completed','closed') THEN 'in_review' ELSE status END,updated_at=? WHERE id=?").bind(now, item.id),
      ]);
      return Response.json({ ok: true, messageId }, { status: 201 });
    }

    stored = await storeAttachmentUploads(item.id, attachmentValues);
    const now = Date.now();
    const messageBody = body || attachmentBody(
      stored.filter((item) => item.contentType.startsWith("image/")).length,
      stored.filter((item) => item.contentType.startsWith("video/")).length,
    );
    const results = await db.batch([
      db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
        .bind(item.id, "customer", messageBody, now),
      ...stored.map((attachment) =>
        db.prepare(
          "INSERT INTO request_attachments (id,request_id,message_created_at,author_type,object_key,filename,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ).bind(
          attachment.id,
          item.id,
          now,
          "customer",
          attachment.objectKey,
          attachment.filename,
          attachment.contentType,
          attachment.sizeBytes,
          now,
        )
      ),
      db.prepare("UPDATE service_requests SET status=CASE WHEN status IN ('received','completed','closed') THEN 'in_review' ELSE status END,updated_at=? WHERE id=?").bind(now, item.id),
    ]);
    const createdMessageId = Number(results[0]?.meta.last_row_id);
    if (!createdMessageId) throw new Error("Message could not be saved.");
    await sendRequestChatNotification({
      requestId: item.id,
      customerName: item.customer_name,
      body: messageBody,
      attachmentCount: stored.length,
      createdAt: now,
      origin: new URL(request.url).origin,
    }).catch((error) => {
      console.error("Request chat notification failed.", error instanceof Error ? error.name : "UnknownError");
      return "failed" as const;
    });
    return Response.json({ ok: true, messageId: createdMessageId }, { status: 201 });
  } catch (error) {
    await removeStoredAttachments(stored);
    const message = error instanceof Error ? error.message : "Message could not be sent.";
    return jsonError(message, message.includes("temporarily") ? 503 : 400);
  }
}
