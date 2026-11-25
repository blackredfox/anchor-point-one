import { MAX_PHOTO_BYTES, MAX_PHOTOS, removeStoredAttachments, storeAttachmentUploads } from "@/lib/attachments";
import { ensureDatabase } from "@/lib/database";
import { jsonError } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) return jsonError("Upload link is invalid or expired.", 404);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES + 100_000) {
    return jsonError("The photo is too large.", 413);
  }

  const db = await ensureDatabase();
  const submission = await db.prepare(`SELECT submissions.request_id,messages.created_at,messages.id
    FROM intake_form_submissions AS submissions JOIN request_messages AS messages ON messages.id=submissions.message_id
    WHERE submissions.upload_token=? AND submissions.created_at>?`)
    .bind(token, Date.now() - 60 * 60_000).first<{ request_id: string; created_at: number; id: number }>();
  if (!submission) return jsonError("Upload link is invalid or expired.", 404);

  let file: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    const photos = form.getAll("photos");
    file = photos.length === 1 ? photos[0] : null;
  } catch {
    return jsonError("Choose a photo to upload.");
  }
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES) {
    return jsonError("Choose one photo of up to 10 MB.");
  }

  let uploads: Awaited<ReturnType<typeof storeAttachmentUploads>>;
  try {
    uploads = await storeAttachmentUploads(submission.request_id, [file]);
  } catch {
    return jsonError("The photo could not be uploaded. Check the format and try again.");
  }
  const photo = uploads[0];
  if (!photo) return jsonError("Choose a photo to upload.");
  if (!photo.contentType.startsWith("image/")) {
    await removeStoredAttachments(uploads);
    return jsonError("Choose a supported photo.");
  }

  try {
    const inserted = await db.prepare(`INSERT INTO request_attachments
      (id,request_id,message_created_at,author_type,object_key,filename,content_type,size_bytes,created_at)
      SELECT ?,?,?,'customer',?,?,?,?,?
      WHERE EXISTS (SELECT 1 FROM request_messages WHERE id=? AND request_id=?)
        AND (SELECT COUNT(*) FROM request_attachments WHERE request_id=? AND message_created_at=?)<?`)
      .bind(photo.id, submission.request_id, submission.created_at, photo.objectKey, photo.filename,
        photo.contentType, photo.sizeBytes, Date.now(), submission.id, submission.request_id,
        submission.request_id, submission.created_at, MAX_PHOTOS).run();
    if (inserted.meta.changes) return Response.json({ ok: true }, { status: 201 });
  } catch {
    await removeStoredAttachments(uploads);
    return jsonError("The photo could not be saved. Try again.", 503);
  }
  await removeStoredAttachments(uploads);
  return jsonError("This message is unavailable or the photo limit has been reached.", 409);
}
