import { getBindings } from "@/lib/database";
import { requestReference } from "@/lib/request-reference";

type ServiceRequestNotification = {
  id: string;
  accessToken: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  serviceType: "rv" | "home" | "not_sure";
  description: string;
  preferredContactMethod: "text" | "email";
  rvType: string;
  rvDetails: string;
  equipmentModel: string;
  appointmentPreference: string;
  origin: string;
};

type NotificationResult = {
  email: "sent" | "not_configured" | "failed";
  sms: "sent" | "not_configured" | "failed";
};

const serviceLabels = {
  rv: "RV service",
  home: "Home service",
  not_sure: "Service type to be confirmed",
} as const;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

async function sendOwnerEmail(
  request: ServiceRequestNotification,
): Promise<NotificationResult["email"]> {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_TO, NOTIFICATION_EMAIL_FROM } =
    getBindings();
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured";
  }

  const ownerUrl = `${request.origin}/owner?request=${encodeURIComponent(request.id)}`;
  const serviceLabel = serviceLabels[request.serviceType];
  const reference = requestReference(request.id);
  const location = request.address || "Not provided";
  const optionalDetails = [
    request.rvType ? `RV type: ${request.rvType}` : "",
    request.rvDetails ? `RV: ${request.rvDetails}` : "",
    request.equipmentModel ? `Equipment: ${request.equipmentModel}` : "",
    request.appointmentPreference ? `Appointment preference: ${request.appointmentPreference}` : "",
  ].filter(Boolean);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [NOTIFICATION_EMAIL_TO],
      ...(request.email ? { reply_to: request.email } : {}),
      subject: `${reference}: New ${serviceLabel} request from ${request.name} | Anchor Point One`,
      text: [
        "A new service request was submitted.",
        "",
        `Customer: ${request.name}`,
        `Service: ${serviceLabel}`,
        `Preferred contact: ${request.preferredContactMethod === "text" ? "Text" : "Email"}`,
        `Phone: ${request.phone || "Not provided"}`,
        `Email: ${request.email || "Not provided"}`,
        `City / ZIP: ${location}`,
        ...optionalDetails,
        "",
        "Request details:",
        request.description,
        "",
        `Open this request in Owner Desk: ${ownerUrl}`,
        "Reply from Owner Desk using the customer's preferred contact method.",
        `Reference: ${reference}`,
      ].join("\n"),
      html: `
        <h2>New service request</h2>
        <p><strong>Customer:</strong> ${escapeHtml(request.name)}</p>
        <p><strong>Service:</strong> ${escapeHtml(serviceLabel)}</p>
        <p><strong>Preferred contact:</strong> ${request.preferredContactMethod === "text" ? "Text" : "Email"}</p>
        <p><strong>Phone:</strong> ${escapeHtml(request.phone || "Not provided")}</p>
        <p><strong>Email:</strong> ${escapeHtml(request.email || "Not provided")}</p>
        <p><strong>City / ZIP:</strong> ${escapeHtml(location)}</p>
        ${request.rvType ? `<p><strong>RV type:</strong> ${escapeHtml(request.rvType)}</p>` : ""}
        ${request.rvDetails ? `<p><strong>RV:</strong> ${escapeHtml(request.rvDetails)}</p>` : ""}
        ${request.equipmentModel ? `<p><strong>Equipment:</strong> ${escapeHtml(request.equipmentModel)}</p>` : ""}
        ${request.appointmentPreference ? `<p><strong>Appointment preference:</strong> ${escapeHtml(request.appointmentPreference)}</p>` : ""}
        <h3>Request details</h3>
        <p style="white-space:pre-wrap">${escapeHtml(request.description)}</p>
        <p><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;padding:12px 18px;background:#b64b1b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">Open Customer Thread in Owner Desk</a></p>
        <p>If the button does not open, copy this direct link:<br><a href="${escapeHtml(ownerUrl)}">${escapeHtml(ownerUrl)}</a></p>
        <p><strong>Reply from Owner Desk using the customer&apos;s preferred contact method.</strong></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });

  if (!response.ok) {
    console.error("Service request email notification failed.", response.status);
    return "failed";
  }
  return "sent";
}

async function sendCustomerEmail(
  request: ServiceRequestNotification,
): Promise<NotificationResult["email"]> {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!request.email || !RESEND_API_KEY || !NOTIFICATION_EMAIL_FROM) return "not_configured";

  const customerUrl = `${request.origin}/request/${encodeURIComponent(request.accessToken)}`;
  const serviceLabel = serviceLabels[request.serviceType];
  const reference = requestReference(request.id);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [request.email],
      subject: `${reference}: Your Anchor Point One service request`,
      text: [
        `Hi ${request.name},`,
        "",
        `We received your ${serviceLabel.toLowerCase()} request (${reference}).`,
        "",
        "We will review the information and confirm the next step before any service is scheduled. Reaching out does not commit you to paid service.",
        "",
        "Use your private link to open this request chat anytime. You can read replies, send messages, and add photos without submitting a new request:",
        customerUrl,
        "",
        "Keep this email for future access, and do not forward the private link.",
        "",
        "Anchor Point One",
      ].join("\n"),
      html: `
        <h2>Your service request has been received</h2>
        <p>Hi ${escapeHtml(request.name)},</p>
        <p>We received your ${escapeHtml(serviceLabel.toLowerCase())} request. Your reference is <strong>${escapeHtml(reference)}</strong>.</p>
        <p>We will review the information and confirm the next step before any service is scheduled. Reaching out does not commit you to paid service.</p>
        <p>Use the private button below to open this request chat anytime. You can read replies, send messages, and add photos without submitting a new request.</p>
        <p><a href="${escapeHtml(customerUrl)}" style="display:inline-block;padding:12px 18px;background:#b64b1b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">View Your Request Chat</a></p>
        <p>If the button does not open, copy this private link:<br><a href="${escapeHtml(customerUrl)}">${escapeHtml(customerUrl)}</a></p>
        <p><strong>Keep this email for future access, and do not forward the private link.</strong></p>
        <p>Anchor Point One</p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });

  if (!response.ok) {
    console.error("Customer request email failed.", response.status);
    return "failed";
  }
  return "sent";
}

export async function sendCustomerReplyEmail(input: {
  email: string;
  name: string;
  body: string;
  requestId: string;
  accessToken: string;
  origin: string;
}) {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!input.email || !RESEND_API_KEY || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured" as const;
  }

  const reference = requestReference(input.requestId);
  const customerUrl = `${input.origin}/request/${encodeURIComponent(input.accessToken)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [input.email],
      subject: `${reference}: New reply from Anchor Point One`,
      text: [
        `Hi ${input.name},`,
        "",
        "Anchor Point One replied to your service request:",
        "",
        input.body,
        "",
        "Open your private request chat to reply or add photos:",
        customerUrl,
        "",
        "Keep this private link and do not forward it.",
      ].join("\n"),
      html: `
        <h2>New reply from Anchor Point One</h2>
        <p>Hi ${escapeHtml(input.name)},</p>
        <p>We replied to your service request:</p>
        <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #b64b1b;white-space:pre-wrap">${escapeHtml(input.body)}</blockquote>
        <p><a href="${escapeHtml(customerUrl)}" style="display:inline-block;padding:12px 18px;background:#b64b1b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">View Your Request Chat</a></p>
        <p><strong>Keep this private link and do not forward it.</strong></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });

  if (!response.ok) {
    console.error("Customer reply email failed.", response.status);
    return "failed" as const;
  }
  return "sent" as const;
}

export async function sendIncomingMessageNotification(input: {
  requestId: string;
  phone: string;
  body: string;
  attachmentCount: number;
  createdAt: number;
  origin: string;
  isNewInquiry: boolean;
}) {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_TO, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured" as const;
  }
  const reference = requestReference(input.requestId);
  const ownerUrl = `${input.origin}/owner?request=${encodeURIComponent(input.requestId)}`;
  const subject = input.isNewInquiry ? "New SMS/MMS inquiry" : "New customer SMS/MMS";
  const timestamp = new Date(input.createdAt).toISOString();
  const message = input.body || (input.attachmentCount ? "Media attachment received." : "No message text provided.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [NOTIFICATION_EMAIL_TO],
      subject: `${reference}: ${subject} from ${input.phone} | Anchor Point One`,
      text: [
        subject,
        "",
        `Customer phone: ${input.phone}`,
        `Received: ${timestamp}`,
        `Attachments: ${input.attachmentCount}`,
        "",
        message,
        "",
        `Open this conversation in Owner Desk: ${ownerUrl}`,
        `Reference: ${reference}`,
      ].join("\n"),
      html: `
        <h2>${escapeHtml(subject)}</h2>
        <p><strong>Customer phone:</strong> ${escapeHtml(input.phone)}</p>
        <p><strong>Received:</strong> ${escapeHtml(timestamp)}</p>
        <p><strong>Attachments:</strong> ${input.attachmentCount}</p>
        <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #b64b1b;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
        <p><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;padding:12px 18px;background:#b64b1b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">Open Customer Thread in Owner Desk</a></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });
  if (!response.ok) {
    console.error("Incoming message owner notification failed.", response.status);
    return "failed" as const;
  }
  return "sent" as const;
}

export async function sendRequestChatNotification(input: {
  requestId: string;
  customerName: string;
  body: string;
  attachmentCount: number;
  createdAt: number;
  origin: string;
}) {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_TO, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured" as const;
  }
  const reference = requestReference(input.requestId);
  const ownerUrl = `${input.origin}/owner?request=${encodeURIComponent(input.requestId)}`;
  const timestamp = new Date(input.createdAt).toISOString();
  const message = input.body || (input.attachmentCount ? "Photo or video attachment received." : "No message text provided.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [NOTIFICATION_EMAIL_TO],
      subject: `${reference}: New request-chat follow-up from ${input.customerName} | Anchor Point One`,
      text: [
        "New customer follow-up in an existing request chat.",
        "",
        `Customer: ${input.customerName}`,
        `Received: ${timestamp}`,
        `Attachments: ${input.attachmentCount}`,
        "",
        message,
        "",
        `Open this conversation in Owner Desk: ${ownerUrl}`,
        `Reference: ${reference}`,
      ].join("\n"),
      html: `
        <h2>New request-chat follow-up</h2>
        <p><strong>Customer:</strong> ${escapeHtml(input.customerName)}</p>
        <p><strong>Received:</strong> ${escapeHtml(timestamp)}</p>
        <p><strong>Attachments:</strong> ${input.attachmentCount}</p>
        <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #b64b1b;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
        <p><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;padding:12px 18px;background:#b64b1b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">Open Customer Thread in Owner Desk</a></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });
  if (!response.ok) {
    console.error("Request chat owner notification failed.", response.status);
    return "failed" as const;
  }
  return "sent" as const;
}

export async function sendVoicemailNotification(input: {
  requestId: string;
  phone: string;
  durationSeconds: number;
  origin: string;
}) {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_TO, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured" as const;
  }
  const reference = requestReference(input.requestId);
  const ownerUrl = `${input.origin}/owner?request=${encodeURIComponent(input.requestId)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [NOTIFICATION_EMAIL_TO],
      subject: `${reference}: New voicemail from ${input.phone} | Anchor Point One`,
      text: [
        "A caller left a new voicemail.",
        "",
        `Caller: ${input.phone}`,
        `Duration: ${input.durationSeconds} seconds`,
        "",
        `Listen in Owner Desk: ${ownerUrl}`,
        `Reference: ${reference}`,
      ].join("\n"),
      html: `
        <h2>New voicemail</h2>
        <p><strong>Caller:</strong> ${escapeHtml(input.phone)}</p>
        <p><strong>Duration:</strong> ${input.durationSeconds} seconds</p>
        <p><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;padding:12px 18px;background:#b64b1b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">Listen in Owner Desk</a></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });
  if (!response.ok) {
    console.error("Voicemail owner notification failed.", response.status);
    return "failed" as const;
  }
  return "sent" as const;
}

export async function sendIncomingCallNotification(input: {
  requestId: string;
  phone: string;
  origin: string;
}) {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_TO, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured" as const;
  }
  const reference = requestReference(input.requestId);
  const ownerUrl = `${input.origin}/owner?request=${encodeURIComponent(input.requestId)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(2_500),
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [NOTIFICATION_EMAIL_TO],
      subject: `${reference}: Incoming call from ${input.phone} | Anchor Point One`,
      text: [
        "A customer called Anchor Point One and was asked to continue by SMS.",
        "",
        `Caller: ${input.phone}`,
        "If the customer sends an SMS or MMS, it will appear in this same request.",
        "",
        `Open in Owner Desk: ${ownerUrl}`,
        `Reference: ${reference}`,
      ].join("\n"),
      html: `
        <h2>Incoming customer call</h2>
        <p><strong>Caller:</strong> ${escapeHtml(input.phone)}</p>
        <p>The caller was asked to continue by SMS. Any SMS or MMS from this number will appear in this same request.</p>
        <p><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;padding:12px 18px;background:#b64b1b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700">Open in Owner Desk</a></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });
  if (!response.ok) {
    console.error("Incoming call owner notification failed.", response.status);
    return "failed" as const;
  }
  return "sent" as const;
}

export async function sendMissedCallNotification(input: {
  requestId: string;
  phone: string;
  origin: string;
}) {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_TO, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured" as const;
  }
  const reference = requestReference(input.requestId);
  const ownerUrl = `${input.origin}/owner?request=${encodeURIComponent(input.requestId)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [NOTIFICATION_EMAIL_TO],
      subject: `${reference}: Call from ${input.phone} ended without voicemail | Anchor Point One`,
      text: [
        "A caller reached Anchor Point One but did not leave a voicemail.",
        "",
        `Caller: ${input.phone}`,
        `Open in Owner Desk: ${ownerUrl}`,
        `Reference: ${reference}`,
      ].join("\n"),
      html: `
        <h2>Call ended without voicemail</h2>
        <p><strong>Caller:</strong> ${escapeHtml(input.phone)}</p>
        <p><a href="${escapeHtml(ownerUrl)}">Open this request in Owner Desk</a></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });
  if (!response.ok) {
    console.error("Missed call owner notification failed.", response.status);
    return "failed" as const;
  }
  return "sent" as const;
}

export async function sendVoicemailTranscriptionNotification(input: {
  requestId: string;
  phone: string;
  transcription: string;
  origin: string;
}) {
  const { RESEND_API_KEY, NOTIFICATION_EMAIL_TO, NOTIFICATION_EMAIL_FROM } = getBindings();
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return "not_configured" as const;
  }
  const reference = requestReference(input.requestId);
  const ownerUrl = `${input.origin}/owner?request=${encodeURIComponent(input.requestId)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFICATION_EMAIL_FROM,
      to: [NOTIFICATION_EMAIL_TO],
      subject: `${reference}: Voicemail transcription ready | Anchor Point One`,
      text: [
        `Caller: ${input.phone}`,
        "",
        "Voicemail transcription:",
        input.transcription,
        "",
        `Open in Owner Desk: ${ownerUrl}`,
      ].join("\n"),
      html: `
        <h2>Voicemail transcription</h2>
        <p><strong>Caller:</strong> ${escapeHtml(input.phone)}</p>
        <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #b64b1b;white-space:pre-wrap">${escapeHtml(input.transcription)}</blockquote>
        <p><a href="${escapeHtml(ownerUrl)}">Open this request in Owner Desk</a></p>
        <p><small>Reference: ${escapeHtml(reference)}</small></p>
      `,
    }),
  });
  if (!response.ok) {
    console.error("Voicemail transcription notification failed.", response.status);
    return "failed" as const;
  }
  return "sent" as const;
}

export async function sendServiceRequestNotifications(
  request: ServiceRequestNotification,
): Promise<NotificationResult> {
  const [ownerEmail, customerEmail] = await Promise.all([
    sendOwnerEmail(request).catch((error) => {
      console.error(
        "Service request email notification failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return "failed" as const;
    }),
    sendCustomerEmail(request).catch((error) => {
      console.error(
        "Customer request email failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return "failed" as const;
    }),
  ]);
  const email = ownerEmail === "failed" || customerEmail === "failed"
    ? "failed"
    : ownerEmail === "sent" || customerEmail === "sent"
      ? "sent"
      : "not_configured";
  return { email, sms: "not_configured" };
}
