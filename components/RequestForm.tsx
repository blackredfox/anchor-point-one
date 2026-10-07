"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { optimizePhoto, validatePhotoSelection } from "@/lib/client-photo";

const initial = {
  name: "",
  email: "",
  phone: "",
  city: "",
  zip: "",
  serviceType: "not_sure",
  preferredContactMethod: "",
  rvType: "",
  rvDetails: "",
  equipmentModel: "",
  description: "",
  smsConsent: false,
  company: "",
};

export function RequestForm() {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoStatuses, setPhotoStatuses] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoStatus, setVideoStatus] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pendingMessageId, setPendingMessageId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const submissionKey = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const update = (key: string, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  function choosePhotos(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    const selectionError = validatePhotoSelection(selected);
    if (selectionError) {
      setError(selectionError);
      return;
    }
    setPhotos(selected);
    setPhotoStatuses(selected.map(() => "Ready"));
    setPendingMessageId(null);
    setError("");
    setStatus("");
  }

  function chooseVideo(files: FileList | null) {
    const selected = files?.[0] ?? null;
    if (selected && selected.size > 25 * 1024 * 1024) {
      setError("Choose a short video that is 25 MB or smaller.");
      return;
    }
    setVideo(selected);
    setVideoStatus(selected ? "Ready" : "");
    setPendingMessageId(null);
    setError("");
    setStatus("");
  }

  async function uploadAttachment(token: string, file: File, messageId?: number) {
    const body = new FormData();
    body.set("body", "");
    body.set("attachments", file);
    if (messageId) body.set("messageId", String(messageId));
    const response = await fetch(`/api/requests/${token}`, { method: "POST", body });
    const value = await response.json() as { error?: string; messageId?: number };
    if (!response.ok || !value.messageId) {
      throw new Error(value.error ?? "File could not be uploaded.");
    }
    return value.messageId;
  }

  async function uploadSelectedFiles(token: string) {
    let messageId = pendingMessageId ?? undefined;
    let sentCount = 0;
    const failedPhotos: File[] = [];
    let failedVideo: File | null = null;
    const failures: string[] = [];
    const queue = [
      ...photos.map((file, index) => ({ file, kind: "photo" as const, index })),
      ...(video ? [{ file: video, kind: "video" as const, index: 0 }] : []),
    ];

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const { file, kind, index } = queue[queueIndex];
      try {
        if (kind === "photo") setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Preparing" : value));
        else setVideoStatus("Preparing");
        setStatus(`Preparing file ${queueIndex + 1} of ${queue.length}: ${file.name}`);
        const prepared = kind === "photo" ? await optimizePhoto(file) : file;
        if (kind === "photo") setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Uploading" : value));
        else setVideoStatus("Uploading");
        setStatus(`Uploading file ${queueIndex + 1} of ${queue.length}: ${file.name}`);
        messageId = await uploadAttachment(token, prepared, messageId);
        if (kind === "photo") setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Uploaded" : value));
        else setVideoStatus("Uploaded");
        sentCount += 1;
      } catch (cause) {
        if (kind === "photo") {
          setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Retry needed" : value));
          failedPhotos.push(file);
        } else {
          setVideoStatus("Retry needed");
          failedVideo = file;
        }
        failures.push(cause instanceof Error ? `${file.name}: ${cause.message}` : `${file.name}: upload failed.`);
      }
    }

    setPhotos(failedPhotos);
    setPhotoStatuses(failedPhotos.map(() => "Retry needed"));
    setVideo(failedVideo);
    setVideoStatus(failedVideo ? "Retry needed" : "");
    const failedCount = failedPhotos.length + (failedVideo ? 1 : 0);
    setPendingMessageId(failedCount ? messageId ?? null : null);
    if (fileInput.current) fileInput.current.value = "";
    if (videoInput.current) videoInput.current.value = "";

    if (failedCount) {
      setStatus("Your request is saved. Retry the remaining files or open the private request chat.");
      setError(`${sentCount} of ${queue.length} files uploaded. ${failures.join(" ")}`);
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.preferredContactMethod) {
      setError("Choose Text or Email as your preferred contact method.");
      return;
    }
    if (form.preferredContactMethod === "text" && !form.phone.trim()) {
      setError("Enter a phone number for text contact.");
      return;
    }
    if (form.preferredContactMethod === "text" && !form.smsConsent) {
      setError("To choose Text, check the SMS consent box or select Email instead.");
      return;
    }
    if (form.preferredContactMethod === "email" && !form.email.trim()) {
      setError("Enter an email address for email contact.");
      return;
    }

    setBusy(true);
    let savedToken = accessToken;
    try {
      let token = savedToken;
      if (!token) {
        submissionKey.current ||= crypto.randomUUID();
        setStatus("Creating your private request…");
        const response = await fetch("/api/requests", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...form, submissionKey: submissionKey.current }),
        });
        const data = await response.json() as { accessToken?: string; error?: string };
        if (!response.ok || !data.accessToken) {
          throw new Error(data.error ?? "Your request could not be submitted.");
        }
        token = data.accessToken;
        savedToken = token;
        setAccessToken(token);
      }

      if ((photos.length || video) && !await uploadSelectedFiles(token)) return;
      setStatus("Request received. Opening your private request chat…");
      router.push(`/request/${token}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your request could not be submitted.");
      setStatus(savedToken ? "Your request is already saved. You can retry without creating another request." : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>Name<input required autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
      <div className="form-row">
        <label>City<input required autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} placeholder="Valrico" /></label>
        <label>ZIP Code<input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(?:-[0-9]{4})?" value={form.zip} onChange={(event) => update("zip", event.target.value)} placeholder="33596" /></label>
      </div>

      <fieldset>
        <legend>Choose a Service</legend>
        <div className="choices">
          {[["rv", "RV"], ["home", "Home"], ["not_sure", "Not Sure"]].map(([value, label]) => <label key={value}>
            <input type="radio" name="serviceType" checked={form.serviceType === value} onChange={() => update("serviceType", value)} />
            <span>{label}</span>
          </label>)}
        </div>
      </fieldset>

      <fieldset>
        <legend>Preferred Contact Method</legend>
        <div className="choices">
          {[["text", "Text"], ["email", "Email"]].map(([value, label]) => <label key={value}>
            <input type="radio" name="preferredContactMethod" checked={form.preferredContactMethod === value} onChange={() => update("preferredContactMethod", value)} />
            <span>{label}</span>
          </label>)}
        </div>
      </fieldset>

      <div className="form-row">
        <label>Mobile Phone<input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(813) 555-0123" /></label>
        <label>Email {form.preferredContactMethod === "email" ? "(required)" : "(optional)"}<input required={form.preferredContactMethod === "email"} type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
      </div>

      <label>RV Type (if known)<input maxLength={80} value={form.rvType} onChange={(event) => update("rvType", event.target.value)} placeholder="Travel trailer, fifth wheel, motorhome…" /></label>
      <label>RV Year / Make / Model (if known)<input maxLength={160} value={form.rvDetails} onChange={(event) => update("rvDetails", event.target.value)} placeholder="2021 Forest River Salem" /></label>
      <label>Appliance or Equipment Model (optional)<input maxLength={160} value={form.equipmentModel} onChange={(event) => update("equipmentModel", event.target.value)} placeholder="Model number, if available" /></label>
      <label>Briefly Describe the Issue<textarea required minLength={20} maxLength={2000} rows={6} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What is happening, when did it start, and what have you tried?" /></label>

      <div className="photo-controls initial-photo-controls">
        <label className="photo-picker">Optional Photos<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple onChange={(event) => choosePhotos(event.target.files)} /><span>Choose Up to 5 Photos</span></label>
        <small>Large photos are optimized and uploaded one at a time after the request is saved.</small>
      </div>
      {photos.length > 0 && <div className="selected-photos">
        {photos.map((photo, index) => <span key={`${photo.name}-${photo.size}-${index}`}>{photo.name} · {photoStatuses[index] ?? "Ready"}<button type="button" aria-label={`Remove ${photo.name}`} onClick={() => { setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index)); setPhotoStatuses((current) => current.filter((_, statusIndex) => statusIndex !== index)); }}>×</button></span>)}
      </div>}
      <div className="photo-controls initial-photo-controls">
        <label className="photo-picker">Optional Short Video<input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => chooseVideo(event.target.files)} /><span>Choose One Short Video</span></label>
        <small>MP4, MOV, or WebM up to 25 MB. Video is uploaded without compression.</small>
      </div>
      {video && <div className="selected-photos"><span>{video.name} · {videoStatus || "Ready"}<button type="button" aria-label={`Remove ${video.name}`} onClick={() => { setVideo(null); setVideoStatus(""); if (videoInput.current) videoInput.current.value = ""; }}>×</button></span></div>}

      <label className="sms-consent">
        <input type="checkbox" checked={form.smsConsent} onChange={(event) => update("smsConsent", event.target.checked)} />
        <span>I agree to receive service-related text messages from AnchorPoint about this request, including scheduling and follow-up. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase. See our <Link href="/privacy" target="_blank">Privacy Policy</Link> and <Link href="/terms" target="_blank">Terms.</Link></span>
      </label>

      <label className="honeypot">Company<input tabIndex={-1} value={form.company} onChange={(event) => update("company", event.target.value)} /></label>
      {status && <p className="notice form-notice" aria-live="polite">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {accessToken && <Link className="button outline" href={`/request/${accessToken}`}>Open Saved Request Chat</Link>}
      <p className="form-disclaimer">Submitting a service request is free and does not obligate you to schedule a paid visit. We will review your information and confirm the recommended next step and applicable pricing before scheduling.</p>
      <button className="button copper" disabled={busy}>{busy ? "Working…" : accessToken ? "Retry Remaining Files" : "Send Service Request"}</button>
      <small>We only ask for the information needed to understand your request, confirm our service area, and suggest the next step. No spam.</small>
    </form>
  );
}
