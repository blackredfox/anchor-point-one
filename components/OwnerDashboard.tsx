"use client";

/* eslint-disable @next/next/no-img-element -- Authenticated customer attachments are served by protected API routes. */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Review = {
  id: string;
  customer_name: string;
  email: string;
  service_type: string;
  rating: number;
  body: string;
  owner_response: string | null;
  created_at: number;
};
type ServiceRequest = {
  id: string;
  reference: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  service_type: string;
  description: string;
  status: string;
  owner_read_at: number | null;
  is_important: number;
  is_unread: number;
  last_inbound_at: number;
  updated_at: number;
  sms_enabled: number;
  preferred_contact_method: "text" | "email" | "web" | null;
  rv_details: string | null;
  equipment_model: string | null;
  appointment_preference: string | null;
  city: string | null;
  postal_code: string | null;
  rv_type: string | null;
  source_channel: string | null;
};
type Attachment = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};
type Message = {
  id: number;
  request_id: string;
  author_type: string;
  body: string;
  created_at: number;
  attachments: Attachment[];
  sms_status: string | null;
  sms_error_code: string | null;
  sms_updated_at: number | null;
};
type Data = {
  admin: { displayName: string; email: string };
  reviews: Review[];
  requests: ServiceRequest[];
  messages: Message[];
  smsReady: boolean;
};

const inlineImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const deliveryLabels: Record<string, string> = {
  accepted: "Accepted by Twilio",
  scheduled: "Scheduled",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent to carrier",
  delivered: "Delivered to phone",
  undelivered: "Not delivered",
  failed: "Failed",
  read: "Read",
  canceled: "Canceled",
};

export function OwnerDashboard({ initialRequestId = "" }: { initialRequestId?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"requests" | "reviews">("requests");
  const [selected, setSelected] = useState("");
  const [reply, setReply] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "important" | "completed">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    const value = await response.json() as Data & { error?: string };
    if (!response.ok) {
      setError(value.error ?? "Could not load owner data.");
      return;
    }
    setData(value);
    setSelected((current) => {
      if (current) return current;
      if (initialRequestId && value.requests.some((item) => item.id === initialRequestId)) {
        return initialRequestId;
      }
      return value.requests[0]?.id || "";
    });
    setError("");
  }, [initialRequestId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    const interval = setInterval(() => void load(), 12_000);
    return () => {
      clearTimeout(id);
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void fetch(`/api/admin/requests/${selected}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ readState: "read" }),
      signal: controller.signal,
    }).then((response) => {
      if (!response.ok) return;
      setData((current) => current ? {
        ...current,
        requests: current.requests.map((item) => item.id === selected
          ? { ...item, is_unread: 0, owner_read_at: Date.now() }
          : item),
      } : current);
    }).catch((cause) => {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError("Could not mark this request as read.");
      }
    });
    return () => controller.abort();
  }, [selected]);

  const current = useMemo(
    () => data?.requests.find((request) => request.id === selected),
    [data, selected],
  );
  const messages = useMemo(
    () => data?.messages.filter((message) => message.request_id === selected) ?? [],
    [data, selected],
  );
  const unreadCount = useMemo(
    () => data?.requests.filter((request) => Boolean(request.is_unread)).length ?? 0,
    [data],
  );
  const filteredRequests = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.requests.filter((request) => {
      const matchesFilter = filter === "all"
        || (filter === "unread" && Boolean(request.is_unread))
        || (filter === "important" && Boolean(request.is_important))
        || (filter === "completed" && request.status === "completed");
      if (!matchesFilter) return false;
      if (!term) return true;
      const messageText = data.messages
        .filter((message) => message.request_id === request.id)
        .map((message) => message.body)
        .join(" ");
      return [request.customer_name, request.phone, request.reference, request.description, messageText]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, filter, search]);
  const preferredContact = current?.preferred_contact_method ?? (current?.sms_enabled ? "text" : current?.email ? "email" : "web");
  const smsActive = Boolean(preferredContact === "text" && current?.sms_enabled && data?.smsReady);
  const emailActive = Boolean(!smsActive && current?.email);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    setError("");
    setNotice("");
    setSending(true);
    try {
      const response = await fetch(`/api/admin/requests/${current.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const value = await response.json() as { error?: string; channel?: "sms" | "email" | "web"; smsStatus?: string; emailStatus?: string };
      if (!response.ok) throw new Error(value.error ?? "Reply could not be sent.");
      setReply("");
      setNotice(value.channel === "sms"
        ? "SMS accepted by Twilio. Delivery status will update in the conversation."
        : value.channel === "email"
          ? value.emailStatus === "sent"
            ? "Reply posted in the private thread and emailed to the customer."
            : "Reply posted in the private thread, but the email notification could not be sent."
          : "Reply posted in the private web thread.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reply could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function updateRequest(id: string, body: Record<string, unknown>, failureMessage: string) {
    setError("");
    const response = await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const value = await response.json() as { error?: string };
      setError(value.error ?? failureMessage);
      return false;
    }
    await load();
    return true;
  }

  async function updateStatus(value: string) {
    if (!current) return;
    await updateRequest(current.id, { status: value }, "Could not update the request status.");
  }

  async function updateReadState(value: "read" | "unread") {
    if (!current) return;
    await updateRequest(current.id, { readState: value }, "Could not update the read status.");
  }

  async function toggleImportant() {
    if (!current) return;
    await updateRequest(current.id, { isImportant: !Boolean(current.is_important) }, "Could not update the Important flag.");
  }

  async function deleteRequest() {
    if (!current) return;
    if (!confirm("Delete this entire request, including its messages and photos? This cannot be undone.")) return;
    const deletingId = current.id;
    const response = await fetch(`/api/admin/requests/${deletingId}`, { method: "DELETE" });
    if (!response.ok) {
      const value = await response.json() as { error?: string };
      setError(value.error ?? "Could not delete this request.");
      return;
    }
    setSelected("");
    setNotice("The request, conversation, and attachments were deleted.");
    await load();
  }

  async function respond(review: Review) {
    const body = (responses[review.id] ?? review.owner_response ?? "").trim();
    if (!body) return;
    await fetch(`/api/admin/reviews/${review.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    await load();
  }

  async function remove(review: Review) {
    if (!confirm(`Delete the review from ${review.customer_name}?`)) return;
    await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
    await load();
  }

  if (!data) return <main className="center"><h1>{error || "Loading owner desk…"}</h1></main>;

  return <main className="owner">
    <header>
      <div><p className="eyebrow light">Anchor Point One</p><h1>Owner Desk</h1></div>
      <div><span>{data.admin.displayName}</span><Link href="/">View website</Link><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></div>
    </header>
    <nav>
      <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Messages ({unreadCount})</button>
      <button className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>Reviews ({data.reviews.length})</button>
      <button onClick={() => load()}>Refresh</button>
    </nav>
    {error && <p className="error">{error}</p>}
    {notice && <p className="notice success">{notice}</p>}

    {tab === "requests" ? <>
      <div className="owner-inbox-toolbar">
        <div className="owner-filters" aria-label="Message filters">
          {(["all", "unread", "important", "completed"] as const).map((value) => <button
            className={filter === value ? "active" : ""}
            key={value}
            onClick={() => setFilter(value)}
          >{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
        <label className="owner-search"><span>Search messages</span><input
          type="search"
          placeholder="Name, phone, or message text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        /></label>
      </div>
      <div className="owner-layout">
      <aside>
        {filteredRequests.length ? filteredRequests.map((request) => <button
          className={`${request.id === selected ? "active " : ""}${request.is_unread ? "unread " : ""}${request.is_important ? "important " : ""}${request.status === "completed" ? "completed" : ""}`.trim()}
          onClick={() => { setSelected(request.id); setError(""); setNotice(""); if (request.id === selected && request.is_unread) void updateRequest(request.id, { readState: "read" }, "Could not mark this request as read."); }}
          key={request.id}
        >
          <span className="request-row-title"><strong>{request.customer_name}</strong>{request.is_important ? <span aria-label="Important" title="Important">★</span> : null}</span>
          <small>{request.reference} · {request.service_type === "rv" ? "RV service" : request.service_type === "home" ? "Home service" : "Not sure"} · {request.status.replaceAll("_", " ")}</small>
          <span className="request-badges">{request.is_unread ? <small>Unread</small> : null}{request.status === "completed" ? <small>Completed</small> : null}</span>
        </button>) : <p className="empty-inbox">No messages match this view.</p>}
      </aside>
      {current ? <section className="owner-detail">
        <div className="owner-title">
          <div><p className="eyebrow">Service request · {current.reference}</p><h2>{current.customer_name}</h2></div>
          <select value={current.status} onChange={(event) => updateStatus(event.target.value)}>
            <option value="received">Received</option>
            <option value="in_review">In review</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="owner-message-actions" aria-label="Message actions">
          <button onClick={() => updateReadState(current.is_unread ? "read" : "unread")}>{current.is_unread ? "Mark as Read" : "Mark as Unread"}</button>
          <button className={current.is_important ? "important active" : "important"} aria-pressed={Boolean(current.is_important)} onClick={toggleImportant}>{current.is_important ? "★ Important" : "☆ Important"}</button>
          <button onClick={() => updateStatus(current.status === "completed" ? "in_review" : "completed")}>{current.status === "completed" ? "Reopen" : "Mark Completed"}</button>
          <button className="danger" onClick={deleteRequest}>Delete</button>
        </div>
        <div className="contact">
          {current.phone ? <a href={`tel:${current.phone}`}><small>Phone</small>{current.phone}</a> : <p><small>Phone</small>Not provided</p>}
          {current.email ? <a href={`mailto:${current.email}`}><small>Email</small>{current.email}</a> : <p><small>Email</small>Not provided</p>}
          <p><small>Location</small>{current.address || "Not provided"}</p>
        </div>
        <p className={smsActive ? "sms-status enabled" : "sms-status"}>
          {smsActive
            ? "Preferred contact: Text. Messages sent here go to the customer’s phone."
            : emailActive
              ? "Preferred contact: Email. Replies are posted in the private thread and emailed to the customer."
              : preferredContact === "text" && current.sms_enabled
                ? "Preferred contact: Text, but the SMS connection is unavailable. A supplied email will be used as fallback."
                : "No notification channel is available. Replies stay in the private web thread."}
        </p>
        {(current.rv_type || current.rv_details || current.equipment_model || current.appointment_preference || current.source_channel) && <dl className="request-details">
          {current.source_channel && <div><dt>Source</dt><dd>{current.source_channel === "sms" ? "Direct SMS/MMS" : current.source_channel === "voice" ? "Phone call / voicemail" : "Website form"}</dd></div>}
          {current.rv_type && <div><dt>RV type</dt><dd>{current.rv_type}</dd></div>}
          {current.rv_details && <div><dt>RV year / make / model</dt><dd>{current.rv_details}</dd></div>}
          {current.equipment_model && <div><dt>Equipment model</dt><dd>{current.equipment_model}</dd></div>}
          {current.appointment_preference && <div><dt>Appointment preference</dt><dd>{current.appointment_preference}</dd></div>}
        </dl>}
        <div className="original"><small>Original request</small><p>{current.description}</p></div>
        <div className="messages">
          {messages.map((message) => <article className={`message ${message.author_type}`} key={message.id}>
            <small>{message.author_type === "owner" ? "Anchor Point One" : message.author_type === "customer" ? current.customer_name : "Request assistant"}</small>
            <p>{message.body}</p>
            {message.attachments?.length > 0 && <div className="message-photos">
              {message.attachments.map((attachment) => {
                const url = `/api/admin/requests/${current.id}/attachments/${attachment.id}`;
              return inlineImageTypes.has(attachment.content_type)
                ? <a href={url} target="_blank" rel="noreferrer" key={attachment.id}><img src={url} alt={attachment.filename} /></a>
                : attachment.content_type.startsWith("video/")
                  ? <video controls preload="metadata" key={attachment.id}><source src={url} type={attachment.content_type} />Open video: <a href={url}>{attachment.filename}</a></video>
                  : attachment.content_type.startsWith("audio/")
                    ? <audio controls preload="metadata" key={attachment.id}><source src={url} type={attachment.content_type} />Open audio: <a href={url}>{attachment.filename}</a></audio>
                  : <a className="photo-file" href={url} target="_blank" rel="noreferrer" key={attachment.id}>Open file: {attachment.filename}</a>;
              })}
            </div>}
            <time>{new Date(message.created_at).toLocaleString()}</time>
            {message.sms_status && <p className={`delivery-status ${message.sms_status}`}>
              SMS: {deliveryLabels[message.sms_status] ?? message.sms_status}
              {message.sms_error_code ? ` · Error ${message.sms_error_code}` : ""}
            </p>}
          </article>)}
        </div>
        <form className="composer" onSubmit={send}>
          <label>{smsActive ? "Text customer" : emailActive ? "Email customer" : "Reply in private thread"}
            <textarea required rows={4} maxLength={1500} value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <small>{smsActive ? "The customer receives this as an SMS from the registered AnchorPoint business number." : emailActive ? "The reply is saved here and the customer receives its text by email with a private chat link." : "The customer will see this reply when they open their private request link."}</small>
          <button className="button copper" disabled={sending}>{sending ? "Sending…" : smsActive ? "Send SMS" : emailActive ? "Post & Email Reply" : "Post Reply"}</button>
        </form>
      </section> : <p>Select a request.</p>}
    </div></> : <div className="owner-reviews">
      {data.reviews.length ? data.reviews.map((review) => <article key={review.id}>
        <div>
          <div><span className="rating">{"★".repeat(review.rating)}</span><h2>{review.customer_name}</h2><p>{review.email} · {review.service_type}</p></div>
          <button onClick={() => remove(review)}>Delete</button>
        </div>
        <blockquote>“{review.body}”</blockquote>
        <label>Anchor Point One response
          <textarea rows={3} maxLength={1200} value={responses[review.id] ?? review.owner_response ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [review.id]: event.target.value }))} />
        </label>
        <button className="button copper" onClick={() => respond(review)}>{review.owner_response ? "Update Response" : "Post Response"}</button>
      </article>) : <p>No reviews yet.</p>}
    </div>}
  </main>;
}
