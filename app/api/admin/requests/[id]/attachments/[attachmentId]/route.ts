import { getAdminIdentity } from "@/lib/admin";
import { storedAttachmentResponse } from "@/lib/attachment-response";
import { ensureDatabase } from "@/lib/database";
import { jsonError } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(request: Request, context: Context) {
  if (!await getAdminIdentity()) return jsonError("Owner access is required.", 403);
  const { id, attachmentId } = await context.params;
  const db = await ensureDatabase();
  const item = await db.prepare(
    "SELECT object_key,filename,content_type,size_bytes FROM request_attachments WHERE request_id=? AND id=?",
  ).bind(id, attachmentId).first<{ object_key: string; filename: string; content_type: string; size_bytes: number }>();
  if (!item) return jsonError("Attachment not found.", 404);
  return storedAttachmentResponse(request, {
    objectKey: item.object_key,
    filename: item.filename,
    contentType: item.content_type,
    sizeBytes: item.size_bytes,
  });
}
