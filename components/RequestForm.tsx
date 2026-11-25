"use client";

import { FormEvent, useRef, useState } from "react";
import { optimizePhoto, validatePhotoSelection } from "@/lib/client-photo";

const initial = { name: "", phone: "", description: "", company: "" };

export function RequestForm({ callToken }: { callToken?: string }) {
  const [form, setForm] = useState(initial);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoStatuses, setPhotoStatuses] = useState<string[]>([]);
  const [uploadToken, setUploadToken] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const submissionKey = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  const isCallForm = Boolean(callToken);

  const update = (key: keyof typeof initial, value: string) =>
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
    setError("");
    setStatus("");
  }

  async function uploadAttachment(token: string, file: File) {
    const body = new FormData();
    body.set("photos", file);
    const response = await fetch(`/api/requests/${token}/photos`, { method: "POST", body });
    const value = await response.json() as { error?: string };
    if (!response.ok) throw new Error(value.error ?? "Photo could not be uploaded.");
  }

  async function uploadPhotos(token: string) {
    const failedPhotos: File[] = [];
    const failures: string[] = [];
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      try {
        setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Preparing" : value));
        setStatus(`Preparing photo ${index + 1} of ${photos.length}: ${photo.name}`);
        const prepared = await optimizePhoto(photo);
        setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Uploading" : value));
        setStatus(`Uploading photo ${index + 1} of ${photos.length}: ${photo.name}`);
        await uploadAttachment(token, prepared);
        setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Uploaded" : value));
      } catch (cause) {
        setPhotoStatuses((current) => current.map((value, statusIndex) => statusIndex === index ? "Retry needed" : value));
        failedPhotos.push(photo);
        failures.push(cause instanceof Error ? `${photo.name}: ${cause.message}` : `${photo.name}: upload failed.`);
      }
    }
    setPhotos(failedPhotos);
    setPhotoStatuses(failedPhotos.map(() => "Retry needed"));
    if (fileInput.current) fileInput.current.value = "";
    if (failedPhotos.length) {
      setError(`Your request was received. ${failures.join(" ")}`);
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    let savedToken = uploadToken;
    try {
      let token = savedToken;
      if (!token) {
        submissionKey.current ||= crypto.randomUUID();
        setStatus("Sending your request…");
        const response = await fetch("/api/requests", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            ...(isCallForm ? { callToken } : { phone: form.phone }),
            description: form.description,
            company: form.company,
            submissionKey: submissionKey.current,
          }),
        });
        const data = await response.json() as { uploadToken?: string; error?: string };
        if (!response.ok || !data.uploadToken) throw new Error(data.error ?? "Your request could not be submitted.");
        token = data.uploadToken;
        savedToken = token;
        setUploadToken(token);
      }
      if (photos.length && !await uploadPhotos(token)) return;
      setStatus("Thank you. Your request has been received. We’ll review it and text you as soon as possible.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your request could not be submitted.");
      setStatus(savedToken ? "Your request is already saved. You can retry the remaining photos." : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>Name<input required autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
      {!isCallForm && <label>Mobile Phone<input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(813) 555-0123" /></label>}
      <label>{isCallForm ? "Describe your RV issue" : "Briefly Describe the Issue"}<textarea required minLength={3} maxLength={2000} rows={6} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe what is happening." /></label>
      <p className="form-help">Please describe what is happening in your own words. You do not need to know the cause or the part that may be needed.</p>
      <div className="photo-controls initial-photo-controls">
        <label className="photo-picker">Optional Photos<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple onChange={(event) => choosePhotos(event.target.files)} /><span>Choose Up to 5 Photos</span></label>
        <small>Large photos are optimized and uploaded one at a time after the request is saved.</small>
      </div>
      {photos.length > 0 && <div className="selected-photos">{photos.map((photo, index) => <span key={`${photo.name}-${photo.size}-${index}`}>{photo.name} · {photoStatuses[index] ?? "Ready"}<button type="button" aria-label={`Remove ${photo.name}`} onClick={() => { setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index)); setPhotoStatuses((current) => current.filter((_, statusIndex) => statusIndex !== index)); }}>×</button></span>)}</div>}
      <label className="honeypot">Company<input tabIndex={-1} value={form.company} onChange={(event) => update("company", event.target.value)} /></label>
      {status && <p className="notice form-notice" aria-live="polite">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="form-disclaimer">Submitting a service request is free and does not obligate you to schedule a paid visit.</p>
      <button className="button copper" disabled={busy || Boolean(uploadToken && !photos.length)}>{busy ? "Working…" : uploadToken && photos.length ? "Retry Remaining Photos" : "Send Service Request — No Obligation"}</button>
    </form>
  );
}
