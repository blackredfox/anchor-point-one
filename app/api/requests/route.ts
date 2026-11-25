import { ensureDatabase } from "@/lib/database";
import { findIntakeRequest, prepareIntake } from "@/lib/intake";
import { deliverIntakeNotifications } from "@/lib/notifications";
import { optionalUsPhone } from "@/lib/phone";
import { jsonError, textField } from "@/lib/validation";
import { hashIntakeToken, randomIntakeToken } from "@/lib/voice-intake";

export const dynamic = "force-dynamic";

const submissionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 12000) {
    return jsonError("Request details are too long.", 413);
  }

  let value: Record<string, unknown>;
  try {
    value = await request.json() as Record<string, unknown>;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  } catch {
    return jsonError("Enter your request details and try again.");
  }

  if (typeof value.company === "string" && value.company.trim()) {
    return Response.json({ uploadToken: randomIntakeToken() });
  }

  const name = textField(value.name, "Name", 1, 100);
  const description = textField(value.description, "Problem description", 3, 2000);
  if (!name.ok) return jsonError(name.message);
  if (!description.ok) return jsonError(description.message);
  const key = typeof value.submissionKey === "string" ? value.submissionKey : "";
  if (!submissionPattern.test(key)) return jsonError("Refresh the page and submit the request again.");

  const db = await ensureDatabase();
  const now = Date.now();
  const isCallLink = value.callToken !== undefined && value.callToken !== null && value.callToken !== "";
  let phone: string;
  let callSid: string | null = null;
  if (isCallLink) {
    if (typeof value.callToken !== "string" || !/^[a-f0-9]{48}$/.test(value.callToken)) {
      return jsonError("This form link is invalid or expired.", 404);
    }
    const call = await db.prepare(`SELECT sid,phone FROM intake_calls
      WHERE token_hash=? AND expires_at>? AND consented_at IS NOT NULL`)
      .bind(await hashIntakeToken(value.callToken), now).first<{ sid: string; phone: string }>();
    if (!call) return jsonError("This form link is invalid or expired.", 404);
    phone = call.phone;
    callSid = call.sid;
  } else {
    const parsed = optionalUsPhone(value.phone);
    if (!parsed.ok || !parsed.data) return jsonError("Enter a valid mobile phone number.");
    phone = parsed.data;
  }

  const submission = callSid ? `call:${callSid}:${key}` : key;
  const lookup = () => db.prepare(`SELECT requests.id,submissions.upload_token
    FROM intake_form_submissions AS submissions JOIN service_requests AS requests ON requests.id=submissions.request_id
    WHERE submissions.submission_key=? AND requests.phone=?`)
    .bind(submission, phone).first<{ id: string; upload_token: string }>();
  const replay = await lookup();
  if (replay) {
    await deliverIntakeNotifications(db, replay.id);
    return Response.json({ uploadToken: replay.upload_token });
  }

  const recent = await db.prepare(`SELECT COUNT(*) AS count FROM intake_form_submissions AS submissions
    JOIN service_requests AS requests ON requests.id=submissions.request_id
    WHERE requests.phone=? AND submissions.created_at>?`).bind(phone, now - 15 * 60_000).first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 3) return jsonError("Too many recent submissions. Please wait and try again.", 429);

  const existing = await findIntakeRequest(db, phone);
  const intake = await prepareIntake(db, {
    phone, name: name.data, description: description.data, source: isCallLink ? "call_link" : "web", now, existing,
  });

  let uploadToken = randomIntakeToken();
  try {
    await db.batch([
      ...intake.newRequest,
      db.prepare(`INSERT INTO request_messages (request_id,author_type,body,created_at)
        SELECT ?,'customer',?,MAX(?,COALESCE(MAX(created_at),0)+1) FROM request_messages WHERE request_id=?`)
        .bind(intake.id, description.data, now, intake.id),
      db.prepare(`INSERT INTO intake_form_submissions (submission_key,request_id,created_at,upload_token,message_id)
        VALUES (?,?,?,?,last_insert_rowid())`).bind(submission, intake.id, now, uploadToken),
      db.prepare(`UPDATE service_requests SET customer_name=CASE WHEN customer_name LIKE 'SMS customer %' OR customer_name LIKE 'Phone caller %' THEN ? ELSE customer_name END,status=CASE WHEN status IN ('completed','closed') THEN 'follow_up_needed' ELSE status END,updated_at=MAX(updated_at,?) WHERE id=?`)
        .bind(name.data, now, intake.id),
      intake.link,
    ]);
  } catch (error) {
    const concurrent = await lookup();
    if (!concurrent) throw error;
    uploadToken = concurrent.upload_token;
  }

  await deliverIntakeNotifications(db, intake.id);
  // Use an upload-only capability so a phone number or a call link cannot expose prior chat history.
  return Response.json({ uploadToken }, { status: 201 });
}
