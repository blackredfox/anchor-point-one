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
  new_intake: number;
  preferred_contact_method: "text" | "email" | "web" | null;
  rv_details: string | null;
  equipment_model: string | null;
  appointment_preference: string | null;
  city: string | null;
  postal_code: string | null;
  rv_type: string | null;
  source_channel: string | null;
  message_count: number;
  call_count: number;
  voice_follow_up_count: number;
  customer_activity_count: number;
  likely_automated: number;
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
type UnverifiedEvent = {
  id: string;
  phone: string | null;
  created_at: number;
  kind: string;
  quarantined: boolean;
};
type Data = {
  admin: { displayName: string; email: string };
  reviews: Review[];
  requests: ServiceRequest[];
  messages: Message[];
  unverified?: UnverifiedEvent[];
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

const statusLabels: Record<string, string> = {
  received: "New request",
  in_review: "Needs clarification",
  verified: "Verified",
  scheduled: "Scheduled",
  in_progress: "In progress",
  waiting_for_approval: "Waiting for approval",
  waiting_for_parts: "Waiting for parts",
  completed: "Completed",
  follow_up_needed: "Follow-up needed",
  spam_unverified: "Spam/Unverified",
  closed: "Closed",
};

export function OwnerDashboard({ initialRequestId = "" }: { initialRequestId?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"requests" | "unverified" | "reviews">("requests");
  const [selected, setSelected] = useState("");
  const [reply, setReply] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [selectingMessages, setSelectingMessages] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [retryingCleanup, setRetryingCleanup] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "important" | "completed">("all");
  const [search, setSearch] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(() => new Set());

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
  const selectedMessageCount = selectedMessageIds.size;
  const messageCount = current?.message_count ?? 0;
  const allMessagesSelected = messageCount > 0 && selectedMessageCount === messageCount;
  const unreadCount = useMemo(
    () => data?.requests.filter((request) => Boolean(request.is_unread)).length ?? 0,
    [data],
  );
  const unverified = data?.unverified ?? [];
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
  const callRequired = Boolean(current?.new_intake && !smsActive && !emailActive);

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

  function toggleMessage(messageId: number) {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  async function toggleAllMessages() {
    if (!current) return;
    if (allMessagesSelected) {
      setSelectedMessageIds(new Set());
      return;
    }
    setSelectingMessages(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/requests/${current.id}/messages`, { cache: "no-store" });
      const result = await response.json() as { messageIds?: number[]; error?: string };
      if (!response.ok || !result.messageIds) throw new Error(result.error ?? "Could not select all messages.");
      setSelectedMessageIds(new Set(result.messageIds));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not select all messages.");
    } finally {
      setSelectingMessages(false);
    }
  }

  async function deleteSelectedMessages() {
    if (!current || deletingMessages || selectingMessages) return;
    const messageIds = [...selectedMessageIds];
    if (!messageIds.length) return;
    const messageLabel = messageIds.length === 1 ? "message" : "messages";
    if (!confirm(`Delete ${messageIds.length} selected ${messageLabel} and their attachments? This cannot be undone.`)) return;

    const requestId = current.id;
    setDeletingMessages(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/requests/${requestId}/messages`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageIds }),
      });
      const value = await response.json() as { error?: string; deletedCount?: number; attachmentCleanup?: "complete" | "pending" };
      if (!response.ok) throw new Error(value.error ?? "Could not delete the selected messages.");
      setSelectedMessageIds(new Set());
      const deletedCount = value.deletedCount ?? messageIds.length;
      setCleanupPending(value.attachmentCleanup === "pending");
      setNotice(value.attachmentCleanup === "pending"
        ? `${deletedCount} ${deletedCount === 1 ? "message was" : "messages were"} deleted. Attachment cleanup is queued for a safe retry.`
        : `${deletedCount} ${deletedCount === 1 ? "message was" : "messages were"} deleted with their attachments.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the selected messages.");
    } finally {
      setDeletingMessages(false);
    }
  }

  async function retryAttachmentCleanup() {
    if (!current || retryingCleanup) return;
    setRetryingCleanup(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/requests/${current.id}/messages`, { method: "POST" });
      const result = await response.json() as { attachmentCleanup?: "complete" | "pending"; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not retry attachment cleanup.");
      setCleanupPending(result.attachmentCleanup === "pending");
      setNotice(result.attachmentCleanup === "pending" ? "Some attachments are still queued for cleanup." : "Attachment cleanup completed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not retry attachment cleanup.");
    } finally {
      setRetryingCleanup(false);
    }
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
      <button className={tab === "unverified" ? "active" : ""} onClick={() => setTab("unverified")}>Spam/Unverified ({unverified.length})</button>
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
          className={`${request.id === selected ? "active " : ""}${request.is_unread ? "unread " : ""}${request.is_important ? "important " : ""}${request.likely_automated ? "possible-automated " : ""}${request.status === "completed" ? "completed" : ""}`.trim()}
          onClick={() => { if (request.id !== selected) setSelectedMessageIds(new Set()); setSelected(request.id); setError(""); setNotice(""); if (request.id === selected && request.is_unread) void updateRequest(request.id, { readState: "read" }, "Could not mark this request as read."); }}
          disabled={deletingMessages || selectingMessages}
          key={request.id}
        >
          <span className="request-row-title"><strong>{request.customer_name}</strong>{request.is_important ? <span aria-label="Important" title="Important">★</span> : null}</span>
          <small>{request.reference} · {request.service_type === "rv" ? "RV service" : request.service_type === "home" ? "Home service" : "Not sure"} · {statusLabels[request.status] ?? request.status.replaceAll("_", " ")}</small>
          <span className="request-badges">
            {request.is_unread ? <small>Unread</small> : null}
            {request.call_count > 0 ? <small>{request.call_count === 1 ? "1 call" : `${request.call_count} calls`}</small> : null}
            {request.likely_automated ? <small className="automated">Possible automated</small> : null}
            {request.status === "completed" ? <small>Completed</small> : null}
          </span>
        </button>) : <p className="empty-inbox">No messages match this view.</p>}
      </aside>
      {current ? <section className="owner-detail">
        <div className="owner-title">
          <div><p className="eyebrow">Service request · {current.reference}</p><h2>{current.customer_name}</h2></div>
          <select value={current.status} onChange={(event) => updateStatus(event.target.value)}>
            <option value="received">New request</option>
            <option value="in_review">Needs clarification</option>
            <option value="verified">Verified</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="waiting_for_approval">Waiting for approval</option>
            <option value="waiting_for_parts">Waiting for parts</option>
            <option value="completed">Completed</option>
            <option value="follow_up_needed">Follow-up needed</option>
            <option value="spam_unverified">Spam/Unverified</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="owner-message-actions" aria-label="Message actions">
          <button onClick={() => updateReadState(current.is_unread ? "read" : "unread")}>{current.is_unread ? "Mark as Read" : "Mark as Unread"}</button>
          <button className={current.is_important ? "important active" : "important"} aria-pressed={Boolean(current.is_important)} onClick={toggleImportant}>{current.is_important ? "★ Important" : "☆ Important"}</button>
          <button onClick={() => updateStatus(current.status === "completed" ? "in_review" : "completed")}>{current.status === "completed" ? "Reopen" : "Mark Completed"}</button>
          <button className="danger" onClick={deleteRequest} disabled={deletingMessages || selectingMessages}>Delete</button>
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
        {current.call_count > 0 && <div className={current.likely_automated ? "call-summary automated" : "call-summary"}>
          <strong>{current.call_count === 1 ? "1 call attempt" : `${current.call_count} call attempts`}</strong>
          <span>{current.likely_automated
            ? "No response or text consent. No SMS was sent. This may have been an automated call."
            : current.customer_activity_count > 0
              ? "The customer responded. Calls, messages, and photos remain together in this thread."
              : current.voice_follow_up_count > 0
                ? "Text consent was received and instructions were sent. The caller has not replied yet."
                : "The call is recorded in this thread; no automatic-spam conclusion was made."}</span>
        </div>}
        {(current.rv_type || current.rv_details || current.equipment_model || current.appointment_preference || current.source_channel) && <dl className="request-details">
          {current.source_channel && <div><dt>Source</dt><dd>{current.source_channel === "sms" ? "Direct SMS/MMS" : current.source_channel === "voice" ? "Phone call / voicemail" : "Website form"}</dd></div>}
          {current.rv_type && <div><dt>RV type</dt><dd>{current.rv_type}</dd></div>}
          {current.rv_details && <div><dt>RV year / make / model</dt><dd>{current.rv_details}</dd></div>}
          {current.equipment_model && <div><dt>Equipment model</dt><dd>{current.equipment_model}</dd></div>}
          {current.appointment_preference && <div><dt>Appointment preference</dt><dd>{current.appointment_preference}</dd></div>}
        </dl>}
        <div className="original"><small>Original request</small><p>{current.description}</p></div>
        <div className="messages">
          <div className="message-selection" aria-label="Select messages to delete">
            <label><input
              type="checkbox"
              checked={allMessagesSelected}
              onChange={toggleAllMessages}
              disabled={!messageCount || deletingMessages || selectingMessages}
            /> Select all messages</label>
            <span>{selectedMessageCount ? `${selectedMessageCount} selected` : "Select messages to delete"}</span>
            <button className="danger" type="button" onClick={deleteSelectedMessages} disabled={!selectedMessageCount || deletingMessages || selectingMessages}>
              {deletingMessages ? "Deleting…" : "Delete selected"}
            </button>
          </div>
          {cleanupPending && <button type="button" onClick={retryAttachmentCleanup} disabled={retryingCleanup}>
            {retryingCleanup ? "Cleaning up…" : "Retry attachment cleanup"}
          </button>}
          {messages.map((message) => <article className={`message ${message.author_type}`} key={message.id}>
            <label className="message-select"><input
              type="checkbox"
              checked={selectedMessageIds.has(message.id)}
              onChange={() => toggleMessage(message.id)}
              disabled={deletingMessages || selectingMessages}
              aria-label={`Select message from ${message.author_type === "owner" ? "Anchor Point One" : message.author_type === "customer" ? current.customer_name : "Request assistant"}`}
            /> Select</label>
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
        {callRequired ? <p className="sms-status">No approved messaging channel is available. Use the phone number above to call the customer.</p> : <form className="composer" onSubmit={send}>
          <label>{smsActive ? "Text customer" : emailActive ? "Email customer" : "Reply in private thread"}
            <textarea required rows={4} maxLength={1500} value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <small>{smsActive ? "The customer receives this as an SMS from the registered AnchorPoint business number." : emailActive ? "The reply is saved here and the customer receives its text by email with a private chat link." : "The customer will see this reply when they open their private request link."}</small>
          <button className="button copper" disabled={sending}>{sending ? "Sending…" : smsActive ? "Send SMS" : emailActive ? "Post & Email Reply" : "Post Reply"}</button>
        </form>}
      </section> : <p>Select a request.</p>}
    </div></> : tab === "unverified" ? <div className="owner-unverified">
      <h2>Spam/Unverified</h2>
      <p>These calls and messages did not create service requests or owner notifications.</p>
      {unverified.length ? <div className="unverified-events">{unverified.map((event) => <article key={event.id}>
        <div><strong>{event.kind.replaceAll("_", " ")}</strong><time>{new Date(event.created_at).toLocaleString()}</time></div>
        <p>{event.phone || "Caller ID unavailable"}</p>
        {event.quarantined ? <small>Quarantined</small> : null}
      </article>)}</div> : <p>No unverified activity.</p>}
    </div> : <div className="owner-reviews">
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
