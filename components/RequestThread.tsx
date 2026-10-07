"use client";

/* eslint-disable @next/next/no-img-element -- Private attachments are served by token-protected API routes. */

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { optimizePhoto, validatePhotoSelection } from "@/lib/client-photo";
import { directSmsInquiriesEnabled, smsHref } from "@/lib/site-config";

type Item = {
  reference: string;
  customerName: string;
  serviceType: string;
  description: string;
  status: string;
  createdAt: number;
};
type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};
type Message = {
  id: number;
  authorType: string;
  body: string;
  createdAt: number;
  attachments: Attachment[];
};

const inlineImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function RequestThread({ token }: { token: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${token}`, { cache: "no-store" });
      const data = await response.json() as {
        request?: Item;
        messages?: Message[];
        error?: string;
      };
      if (!response.ok || !data.request) throw new Error(data.error ?? "Request not found.");
      setItem(data.request);
      setMessages(data.messages ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 12_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [load]);

  function choosePhotos(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    const selectionError = validatePhotoSelection(selected);
    if (selectionError) {
      setError(selectionError);
      return;
    }
    setPhotos(selected);
    setPendingMessageId(null);
    setUploadStatus("");
    setError("");
  }

  async function postMessage(photo?: File, messageId?: number) {
    const form = new FormData();
    form.set("body", messageId ? "" : body.trim());
    if (photo) form.set("photos", photo);
    if (messageId) form.set("messageId", String(messageId));
    const response = await fetch(`/api/requests/${token}`, { method: "POST", body: form });
    const data = await response.json() as { error?: string; messageId?: number };
    if (!response.ok || !data.messageId) {
      throw new Error(data.error ?? "Message could not be sent.");
    }
    return data.messageId;
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() && !photos.length) return;
    setBusy(true);
    setError("");
    setUploadStatus("");
    try {
      if (!photos.length) {
        await postMessage();
        setBody("");
        await load();
        return;
      }

      let messageId = body.trim() ? undefined : pendingMessageId ?? undefined;
      let sentCount = 0;
      const failed: File[] = [];
      const failureDetails: string[] = [];

      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        try {
          setUploadStatus(`Preparing photo ${index + 1} of ${photos.length}: ${photo.name}`);
          const optimized = await optimizePhoto(photo);
          setUploadStatus(`Uploading photo ${index + 1} of ${photos.length}: ${photo.name}`);
          messageId = await postMessage(optimized, messageId);
          sentCount += 1;
        } catch (cause) {
          failed.push(photo);
          failureDetails.push(cause instanceof Error ? `${photo.name}: ${cause.message}` : `${photo.name}: upload failed.`);
        }
      }

      if (!sentCount && body.trim()) {
        await postMessage();
        setBody("");
      } else if (sentCount) {
        setBody("");
      }

      setPhotos(failed);
      setPendingMessageId(failed.length ? messageId ?? null : null);
      if (fileInput.current) fileInput.current.value = "";
      await load();

      if (failed.length) {
        const sentLabel = sentCount ? `${sentCount} of ${photos.length} photos sent. ` : "No photos were sent. ";
        setError(`${sentLabel}${failureDetails.join(" ")}`);
        setUploadStatus(sentCount ? "You can retry the remaining photos without losing the successful uploads." : "Please choose smaller photos or screenshots and try again.");
      } else {
        setUploadStatus(`${sentCount} ${sentCount === 1 ? "photo" : "photos"} sent successfully.`);
        setPendingMessageId(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent.");
      setUploadStatus("");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="center">Opening your request…</div>;
  if (!item) {
    return <div className="center"><h1>We could not open this request.</h1><p>{error}</p></div>;
  }

  return <div className="thread">
    <aside>
      <p className="eyebrow light">Private service request</p>
      <h1>Hi, {item.customerName}.</h1>
      <p>Your request is saved under the same reference below. Keep this page link private and use it to continue the conversation or add photos. No service is scheduled until scope, availability, and pricing are confirmed.</p>
      <dl>
        <div><dt>Status</dt><dd><span className="status">{item.status.replaceAll("_", " ")}</span></dd></div>
        <div><dt>Service</dt><dd>{item.serviceType === "rv" ? "RV service" : item.serviceType === "home" ? "Home service" : "To be confirmed"}</dd></div>
        <div><dt>Reference</dt><dd>{item.reference}</dd></div>
      </dl>
      <button className="button light-outline" onClick={() => navigator.clipboard.writeText(location.href)}>Copy Private Link</button>
      {directSmsInquiriesEnabled && <a className="button light-outline" href={smsHref(item.serviceType === "home" ? "home" : "rv", item.reference)}>Text Additional Photos or Video</a>}
      <div className="original"><small>Your original request</small><p>{item.description}</p></div>
    </aside>
    <section>
      <div className="conversation-head"><h2>Messages with Anchor Point One</h2><button onClick={() => load()}>Refresh</button></div>
      <div className="messages">
        {messages.map((message) => <article className={`message ${message.authorType}`} key={message.id}>
          <small>{message.authorType === "owner" ? "Anchor Point One" : message.authorType === "customer" ? "You" : "Request assistant"}</small>
          <p>{message.body}</p>
          {message.attachments?.length > 0 && <div className="message-photos">
            {message.attachments.map((attachment) => {
              const url = `/api/requests/${token}/attachments/${attachment.id}`;
              return inlineImageTypes.has(attachment.contentType)
                ? <a href={url} target="_blank" rel="noreferrer" key={attachment.id}><img src={url} alt={attachment.filename} /></a>
                : attachment.contentType.startsWith("video/")
                  ? <video controls preload="metadata" key={attachment.id}><source src={url} type={attachment.contentType} />Open video: <a href={url}>{attachment.filename}</a></video>
                  : attachment.contentType.startsWith("audio/")
                    ? <audio controls preload="metadata" key={attachment.id}><source src={url} type={attachment.contentType} />Open audio: <a href={url}>{attachment.filename}</a></audio>
                  : <a className="photo-file" href={url} target="_blank" rel="noreferrer" key={attachment.id}>Open file: {attachment.filename}</a>;
            })}
          </div>}
          <time>{new Date(message.createdAt).toLocaleString()}</time>
        </article>)}
      </div>
      <form className="composer" onSubmit={send}>
        <label>Add a message or photos
          <textarea maxLength={2000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <div className="photo-controls">
          <label className="photo-picker">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple onChange={(event) => choosePhotos(event.target.files)} />
            <span>Attach photos</span>
          </label>
          <small>{uploadStatus || "Up to 5 photos, 10 MB each. Large photos are optimized automatically."}</small>
        </div>
        {photos.length > 0 && <div className="selected-photos">
          {photos.map((photo, index) => <span key={`${photo.name}-${photo.size}-${index}`}>
            {photo.name}
            <button type="button" aria-label={`Remove ${photo.name}`} onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}>×</button>
          </span>)}
        </div>}
        {error && <p className="error">{error}</p>}
        <button className="button copper" disabled={busy || (!body.trim() && !photos.length)}>{busy ? "Sending…" : "Send Message"}</button>
      </form>
    </section>
  </div>;
}
