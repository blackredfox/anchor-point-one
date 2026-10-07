import { getBindings } from "@/lib/database";

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEOS = 1;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_VOICEMAIL_BYTES = 15 * 1024 * 1024;

export type StoredAttachment = {
  id: string;
  objectKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["heif", "mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

function detectAttachmentType(bytes: Uint8Array, declaredType: string) {
  const imageType = detectImageType(bytes);
  if (imageType) return imageType;
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (
    bytes.length >= 12 &&
    ascii(4, 4) === "ftyp" &&
    ["video/mp4", "video/quicktime"].includes(declaredType)
  ) {
    return declaredType;
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 &&
    declaredType === "video/webm"
  ) {
    return declaredType;
  }
  return null;
}

function safeFilename(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._ -]/g, "_").trim();
  return (cleaned || "photo").slice(0, 120);
}

export async function storeAttachmentUploads(requestId: string, values: FormDataEntryValue[]) {
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_PHOTOS + MAX_VIDEOS) throw new Error(`Upload up to ${MAX_PHOTOS} photos and one short video at a time.`);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_UPLOAD_BYTES) throw new Error("The selected files are too large. Upload up to 30 MB at a time.");

  const { BUCKET } = getBindings();
  if (files.length && !BUCKET) throw new Error("File uploads are temporarily unavailable.");

  const prepared: Array<{ file: File; bytes: Uint8Array; contentType: string }> = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectAttachmentType(bytes, file.type);
    if (!contentType) throw new Error("Use a JPEG, PNG, WebP, GIF, HEIC, HEIF, MP4, MOV, or WebM file.");
    const isVideo = contentType.startsWith("video/");
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (file.size > maxBytes) throw new Error(isVideo ? "A short video must be 25 MB or smaller." : "Each photo must be 10 MB or smaller.");
    prepared.push({ file, bytes, contentType });
  }
  if (prepared.filter((item) => item.contentType.startsWith("image/")).length > MAX_PHOTOS) {
    throw new Error(`Upload up to ${MAX_PHOTOS} photos at a time.`);
  }
  if (prepared.filter((item) => item.contentType.startsWith("video/")).length > MAX_VIDEOS) {
    throw new Error("Upload one short video at a time.");
  }

  const stored: StoredAttachment[] = [];
  try {
    for (const { file, bytes, contentType } of prepared) {
      const id = crypto.randomUUID();
      const objectKey = `requests/${requestId}/${id}.${extensionByType[contentType]}`;
      await BUCKET!.put(objectKey, bytes, {
        httpMetadata: { contentType },
        customMetadata: { originalFilename: safeFilename(file.name) },
      });
      stored.push({
        id,
        objectKey,
        filename: safeFilename(file.name),
        contentType,
        sizeBytes: file.size,
      });
    }
    return stored;
  } catch (error) {
    await Promise.all(stored.map((item) => BUCKET?.delete(item.objectKey)));
    throw error;
  }
}

async function readBoundedResponse(response: Response, perFileLimit: number, remainingTotal: number) {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  const limit = Math.min(perFileLimit, remainingTotal);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error("A Twilio attachment exceeds the allowed size.");
  }
  if (!response.body) throw new Error("A Twilio attachment has no content.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("A Twilio attachment exceeds the allowed size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes: combined.buffer as ArrayBuffer, size };
}

export async function storeTwilioMedia(
  requestId: string,
  media: Array<{ url: string; contentType: string }>,
) {
  if (!media.length) return [];
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = getBindings();
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio media credentials are unavailable.");
  }
  if (media.length > MAX_PHOTOS + MAX_VIDEOS) {
    throw new Error("The message contains too many attachments.");
  }
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const files: File[] = [];
  let totalBytes = 0;
  for (let index = 0; index < media.length; index += 1) {
    const item = media[index];
    if (!extensionByType[item.contentType]) {
      throw new Error("A Twilio attachment type is not supported.");
    }
    const url = new URL(item.url);
    if (url.protocol !== "https:" || url.hostname !== "api.twilio.com") {
      throw new Error("The Twilio attachment URL is invalid.");
    }
    const response = await fetch(url, { headers: { authorization: `Basic ${credentials}` } });
    if (!response.ok) throw new Error("A Twilio attachment could not be downloaded.");
    const isVideo = item.contentType.startsWith("video/");
    const { bytes, size } = await readBoundedResponse(
      response,
      isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES,
      MAX_UPLOAD_BYTES - totalBytes,
    );
    totalBytes += size;
    const extension = extensionByType[item.contentType] ?? "bin";
    files.push(new File([bytes], `twilio-${index + 1}.${extension}`, { type: item.contentType }));
  }
  return storeAttachmentUploads(requestId, files);
}

export async function removeStoredAttachments(items: StoredAttachment[]) {
  const { BUCKET } = getBindings();
  if (!BUCKET) return;
  await Promise.all(items.map((item) => BUCKET.delete(item.objectKey)));
}

export async function storeTwilioRecording(
  requestId: string,
  recordingSid: string,
  recordingUrl: string,
): Promise<StoredAttachment> {
  const { BUCKET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = getBindings();
  if (!BUCKET) throw new Error("Voicemail storage is unavailable.");
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio recording credentials are unavailable.");
  }
  if (!/^RE[a-zA-Z0-9]{20,64}$/.test(recordingSid)) {
    throw new Error("The Twilio recording identifier is invalid.");
  }
  const url = new URL(recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`);
  if (url.protocol !== "https:" || url.hostname !== "api.twilio.com") {
    throw new Error("The Twilio recording URL is invalid.");
  }
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const response = await fetch(url, { headers: { authorization: `Basic ${credentials}` } });
  if (!response.ok) throw new Error("The Twilio voicemail could not be downloaded.");
  const { bytes, size } = await readBoundedResponse(response, MAX_VOICEMAIL_BYTES, MAX_VOICEMAIL_BYTES);
  const id = crypto.randomUUID();
  const objectKey = `requests/${requestId}/${id}.mp3`;
  await BUCKET.put(objectKey, bytes, {
    httpMetadata: { contentType: "audio/mpeg" },
    customMetadata: { originalFilename: `voicemail-${recordingSid.slice(-8)}.mp3` },
  });
  return {
    id,
    objectKey,
    filename: `voicemail-${recordingSid.slice(-8)}.mp3`,
    contentType: "audio/mpeg",
    sizeBytes: size,
  };
}
