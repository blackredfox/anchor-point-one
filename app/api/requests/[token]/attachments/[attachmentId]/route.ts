import { storedAttachmentResponse } from "@/lib/attachment-response";
import { ensureDatabase } from "@/lib/database";
import { jsonError } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string; attachmentId: string }> };

export async function GET(request: Request, context: Context) {
  const { token, attachmentId } = await context.params;
  if (!/^[a-f0-9]{48}$/.test(token) || !/^[a-f0-9-]{36}$/.test(attachmentId)) {
    return jsonError("Attachment not found.", 404);
  }
  const db = await ensureDatabase();
  const item = await db.prepare(`SELECT request_attachments.object_key,request_attachments.filename,
      request_attachments.content_type,request_attachments.size_bytes
    FROM request_attachments
    INNER JOIN service_requests ON service_requests.id=request_attachments.request_id
    WHERE service_requests.access_token=? AND request_attachments.id=?`)
    .bind(token, attachmentId)
    .first<{ object_key: string; filename: string; content_type: string; size_bytes: number }>();
  if (!item) return jsonError("Attachment not found.", 404);
  return storedAttachmentResponse(request, {
    objectKey: item.object_key,
    filename: item.filename,
    contentType: item.content_type,
    sizeBytes: item.size_bytes,
  });
}
