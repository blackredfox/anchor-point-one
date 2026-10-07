import { getBindings } from "@/lib/database";
import { jsonError } from "@/lib/validation";

type StoredAttachmentItem = {
  objectKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

function safeDownloadName(value: string) {
  return value.replace(/[^\x20-\x7E]|["\\]/g, "_");
}

function parseByteRange(value: string | null, size: number) {
  if (!value) return null;
  const match = value.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2]) || size <= 0) return "invalid" as const;

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid" as const;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      return "invalid" as const;
    }
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export async function storedAttachmentResponse(request: Request, item: StoredAttachmentItem) {
  const { BUCKET } = getBindings();
  if (!BUCKET) return jsonError("Attachment storage is unavailable.", 503);

  const parsedRange = parseByteRange(request.headers.get("range"), item.sizeBytes);
  if (parsedRange === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes */${item.sizeBytes}`,
        "cache-control": "private, no-store",
      },
    });
  }

  const object = parsedRange
    ? await BUCKET.get(item.objectKey, { range: { offset: parsedRange.start, length: parsedRange.end - parsedRange.start + 1 } })
    : await BUCKET.get(item.objectKey);
  if (!object) return jsonError("Attachment not found.", 404);

  const contentLength = parsedRange
    ? parsedRange.end - parsedRange.start + 1
    : item.sizeBytes;
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "content-disposition": `inline; filename="${safeDownloadName(item.filename)}"`,
    "content-length": String(contentLength),
    "content-type": item.contentType,
    "x-content-type-options": "nosniff",
  });
  if (parsedRange) {
    headers.set("content-range", `bytes ${parsedRange.start}-${parsedRange.end}/${item.sizeBytes}`);
  }
  return new Response(object.body, { status: parsedRange ? 206 : 200, headers });
}
