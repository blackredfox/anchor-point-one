import { ensureDatabase } from "@/lib/database";
import { sendServiceRequestNotifications } from "@/lib/notifications";
import { optionalUsPhone } from "@/lib/phone";
import { recordTwilioDelivery, sendTwilioMessage } from "@/lib/twilio";
import { requestReference } from "@/lib/request-reference";
import { choiceField, jsonError, optionalEmailField, optionalTextField, textField } from "@/lib/validation";

export const dynamic = "force-dynamic";

const types = ["rv", "home", "not_sure"] as const;
const contactMethods = ["text", "email"] as const;
const submissionKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const token = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

function customerConfirmationBody(
  requestId: string,
  serviceType: (typeof types)[number],
) {
  const reference = requestReference(requestId);
  const serviceLabel = {
    rv: "RV service",
    home: "home service",
    not_sure: "your requested service",
  }[serviceType];
  return `AnchorPoint: We received service request #${reference} for ${serviceLabel}. We will review it and recommend the next step before any paid service is scheduled. Reply STOP to opt out.`;
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 12000) {
    return jsonError("Request details are too long.", 413);
  }

  let value: Record<string, unknown>;
  try {
    value = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Enter your request details and try again.");
  }

  if (typeof value.company === "string" && value.company.trim()) {
    return Response.json({ accessToken: token() });
  }

  const name = textField(value.name, "First name", 1, 100);
  const email = optionalEmailField(value.email);
  const phone = optionalUsPhone(value.phone);
  const city = textField(value.city, "City", 2, 80);
  const postalCodeValue = typeof value.zip === "string" ? value.zip.trim() : "";
  const postalCode = /^\d{5}(?:-\d{4})?$/.test(postalCodeValue)
    ? { ok: true as const, data: postalCodeValue }
    : { ok: false as const, message: "Enter a valid 5-digit ZIP code." };
  const service = choiceField(value.serviceType, types, "service type");
  const preferredContact = choiceField(
    value.preferredContactMethod,
    contactMethods,
    "preferred contact method",
  );
  const rvType = optionalTextField(value.rvType, "RV type", 80);
  const rvDetails = optionalTextField(value.rvDetails, "RV year, make, and model", 160);
  const equipmentModel = optionalTextField(value.equipmentModel, "Appliance or equipment model", 160);
  const appointmentPreference = optionalTextField(value.appointmentPreference, "Appointment preference", 160);
  const description = textField(
    value.description,
    "Problem description",
    20,
    2000,
  );
  const invalid = [
    name,
    email,
    phone,
    city,
    postalCode,
    service,
    preferredContact,
    rvType,
    rvDetails,
    equipmentModel,
    appointmentPreference,
    description,
  ]
    .find((item) => !item.ok);
  if (invalid && !invalid.ok) return jsonError(invalid.message);
  if (
    !name.ok ||
    !email.ok ||
    !phone.ok ||
    !city.ok ||
    !postalCode.ok ||
    !service.ok ||
    !preferredContact.ok ||
    !rvType.ok ||
    !rvDetails.ok ||
    !equipmentModel.ok ||
    !appointmentPreference.ok ||
    !description.ok
  ) {
    return jsonError("Review the form and try again.");
  }

  const smsConsent = value.smsConsent === true;
  if (!phone.data) {
    return jsonError("Enter a mobile phone number.");
  }
  if (preferredContact.data === "text" && !smsConsent) {
    return jsonError("To choose text contact, provide SMS consent or select email instead.");
  }
  if (preferredContact.data === "email" && !email.data) {
    return jsonError("Enter an email address for email contact.");
  }
  if (smsConsent && !phone.data) {
    return jsonError("Enter a phone number before providing SMS consent.");
  }

  const submissionKey = typeof value.submissionKey === "string"
    ? value.submissionKey.trim()
    : "";
  if (!submissionKeyPattern.test(submissionKey)) {
    return jsonError("Refresh the page and submit the request again.");
  }

  const db = await ensureDatabase();
  const existing = await db.prepare(`SELECT service_requests.access_token
    FROM request_preferences
    INNER JOIN service_requests ON service_requests.id=request_preferences.request_id
    WHERE request_preferences.submission_key=?`)
    .bind(submissionKey)
    .first<{ access_token: string }>();
  if (existing?.access_token) {
    return Response.json({ accessToken: existing.access_token });
  }

  const recent = await db.prepare(`SELECT COUNT(*) AS count FROM service_requests
    WHERE created_at>? AND (
      (? != '' AND phone=?) OR
      (? != '' AND email=?)
    )`)
    .bind(
      Date.now() - 15 * 60 * 1000,
      phone.data,
      phone.data,
      email.data,
      email.data,
    )
    .first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 3) {
    return jsonError("Too many recent requests were submitted for this contact. Please wait and try again.", 429);
  }

  const id = crypto.randomUUID();
  const accessToken = token();
  const now = Date.now();
  const address = `${city.data}, ${postalCode.data}`;
  const statements = [
    db.prepare("INSERT INTO service_requests (id,access_token,customer_name,email,phone,address,service_type,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(
        id,
        accessToken,
        name.data,
        email.data,
        phone.data,
        address,
        service.data,
        description.data,
        "received",
        now,
        now,
      ),
    db.prepare("INSERT INTO request_preferences (request_id,submission_key,preferred_contact_method,rv_details,equipment_model,appointment_preference,city,postal_code,rv_type,source_channel) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(
        id,
        submissionKey,
        preferredContact.data,
        rvDetails.data,
        equipmentModel.data,
        appointmentPreference.data,
        city.data,
        postalCode.data,
        rvType.data,
        "web",
      ),
    db.prepare("INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)")
      .bind(
        id,
        "system",
        "Thank you — we received your request. We will review the information and recommend the next step. If additional photos, video, model information, or other details are needed, we may contact you before recommending service. Submitting this request does not create a paid appointment.",
        now,
      ),
  ];

  if (smsConsent) {
    statements.push(
      db.prepare("INSERT INTO sms_consents (request_id,phone_e164,consented_at,consent_version,consent_method,consent_call_sid) VALUES (?,?,?,?,?,NULL)")
        .bind(id, phone.data, now, "2026-07-30", "website_form_checkbox"),
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const concurrent = await db.prepare(`SELECT service_requests.access_token
      FROM request_preferences
      INNER JOIN service_requests ON service_requests.id=request_preferences.request_id
      WHERE request_preferences.submission_key=?`)
      .bind(submissionKey)
      .first<{ access_token: string }>();
    if (concurrent?.access_token) {
      return Response.json({ accessToken: concurrent.access_token });
    }
    throw error;
  }

  const origin = new URL(request.url).origin;
  const confirmationBody = customerConfirmationBody(id, service.data);
  const [, customerSms] = await Promise.all([
    sendServiceRequestNotifications({
      id,
      accessToken,
      name: name.data,
      email: email.data,
      phone: phone.data,
      address,
      serviceType: service.data,
      description: description.data,
      preferredContactMethod: preferredContact.data,
      rvType: rvType.data,
      rvDetails: rvDetails.data,
      equipmentModel: equipmentModel.data,
      appointmentPreference: appointmentPreference.data,
      origin,
    }),
    smsConsent
      ? sendTwilioMessage(phone.data, confirmationBody).catch((error) => {
          console.error(
            "Customer confirmation SMS failed.",
            error instanceof Error ? error.name : "UnknownError",
          );
          return { ok: false as const, reason: "failed" as const };
        })
      : Promise.resolve(null),
  ]);

  if (customerSms?.ok) {
    try {
      const messageCreatedAt = Date.now();
      const inserted = await db.prepare(
        "INSERT INTO request_messages (request_id,author_type,body,created_at) VALUES (?,?,?,?)",
      ).bind(id, "system", confirmationBody, messageCreatedAt).run();
      const messageId = Number(inserted.meta.last_row_id);
      if (!messageId) throw new Error("SMS message record was not created.");
      await recordTwilioDelivery(db, {
        sid: customerSms.sid,
        requestId: id,
        messageId,
        direction: "outbound_confirmation",
        status: customerSms.status,
        createdAt: messageCreatedAt,
      });
      await db.prepare(`INSERT INTO phone_conversations (phone_e164,active_request_id,last_activity_at,last_ack_at)
        VALUES (?,?,?,NULL) ON CONFLICT(phone_e164) DO UPDATE SET
        active_request_id=excluded.active_request_id,last_activity_at=excluded.last_activity_at`)
        .bind(phone.data, id, messageCreatedAt)
        .run();
    } catch (error) {
      console.error(
        "Customer confirmation SMS logging failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
    }
  }

  return Response.json({ accessToken }, { status: 201 });
}
