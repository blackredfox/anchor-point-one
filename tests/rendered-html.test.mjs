import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const environment = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const context = { waitUntil() {}, passThroughOnException() {} };

async function fetchPath(path, accept = "text/html") {
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept } }), environment, context);
}

async function html(path) {
  const response = await fetchPath(path);
  assert.equal(response.status, 200, `${path} should render`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

test("renders public routes with one H1, canonical metadata, and the new brand", async () => {
  const routes = [
    ["/", "Mobile RV Diagnostics, Inspections &amp; Repair Support in Tampa Bay"],
    ["/rv-services", "Mobile RV Diagnostics, Inspections &amp; Repair Support in Tampa Bay"],
    ["/home-services", "Select Minor Home Services in Tampa Bay"],
    ["/faq", "Frequently Asked Questions"],
    ["/pricing-service-policy", "Pricing &amp; Service Policy"],
  ];

  for (const [path, heading] of routes) {
    const body = await html(path);
    assert.equal((body.match(/<h1\b/gi) ?? []).length, 1, `${path} should have one H1`);
    assert.match(body, new RegExp(heading));
    assert.match(body, /Anchor Point One/);
    assert.match(body, new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/anchorpoint\.help${path === "/" ? "/" : path}["']`, "i"));
  }
});

test("keeps preview metadata and removes out-of-scope public services", async () => {
  const homepage = await html("/");
  const homeServices = await html("/home-services");
  assert.match(homepage, /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i);
  assert.match(homepage, /approximately 50 miles/i);
  for (const body of [homepage, homeServices]) {
    assert.doesNotMatch(body, /Microwave Installation|Washer Installation|Dishwasher Installation|Refrigerator Installation|Garbage Disposal Replacement|Drywall Repair/i);
  }
});

test("publishes matching visible FAQ and FAQ structured data", async () => {
  const body = await html("/faq");
  assert.match(body, /application\/ld\+json/);
  assert.match(body, /FAQPage/);
  assert.match(body, /Do I need to know what is wrong before contacting you\?/);
  assert.match(body, /What does the \$150 Diagnostic and Service Visit include\?/);
  assert.match(body, /aria-expanded=/);
  assert.match(body, /aria-controls=/);
  assert.match(body, />General<|>Pricing<|>RV Services<|>Home Services</);
  assert.doesNotMatch(body, /What payment methods do you accept\?/);
});

test("serves sitemap and robots without private or blocked routes", async () => {
  const sitemap = await (await fetchPath("/sitemap.xml", "application/xml")).text();
  assert.match(sitemap, /https:\/\/anchorpoint\.help\/rv-services/);
  assert.match(sitemap, /https:\/\/anchorpoint\.help\/home-services/);
  assert.match(sitemap, /https:\/\/anchorpoint\.help\/faq/);
  assert.match(sitemap, /https:\/\/anchorpoint\.help\/pricing-service-policy/);
  assert.doesNotMatch(sitemap, /\/owner|\/request\//);

  const robots = await (await fetchPath("/robots.txt", "text/plain")).text();
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/owner/);
  assert.match(robots, /Disallow: \/request\//);
  assert.match(robots, /Sitemap: https:\/\/anchorpoint\.help\/sitemap\.xml/);
});

test("keeps outbound Twilio messages URL-free and follow-ups request-aware", async () => {
  const createRoute = await readFile(new URL("../app/api/requests/route.ts", import.meta.url), "utf8");
  const replyRoute = await readFile(new URL("../app/api/admin/requests/[id]/route.ts", import.meta.url), "utf8");
  const incomingRoute = await readFile(new URL("../app/api/twilio/incoming/route.ts", import.meta.url), "utf8");
  const routing = await readFile(new URL("../lib/conversation-routing.ts", import.meta.url), "utf8");

  const confirmation = createRoute.match(/return `(AnchorPoint:[^`]+)`;/)?.[1] ?? "";
  const ownerReply = replyRoute.match(/const outgoing = `(AnchorPoint[^`]+)`;/)?.[1] ?? "";
  assert.ok(confirmation);
  assert.ok(ownerReply);
  assert.doesNotMatch(confirmation, /https?:\/\//i);
  assert.doesNotMatch(ownerReply, /https?:\/\//i);
  assert.match(routing, /AP-\(\[A-F0-9\]\{8\}\)/);
  assert.match(incomingRoute, /phone_conversations\.active_request_id/);
  assert.match(incomingRoute, /INSERT OR IGNORE INTO service_requests/);
  assert.match(incomingRoute, /NumMedia/);
  assert.match(incomingRoute, /MediaUrl\$\{index\}/);
  assert.match(incomingRoute, /\(\?:SM\|MM\)/);
  assert.match(incomingRoute, /status IN \('received','completed','closed'\)/);
  assert.match(incomingRoute, /TWILIO_AUTO_ACK_ENABLED === "true"/);
  assert.match(routing, /ACK_COOLDOWN_MS = 24 \* 60 \* 60 \* 1000/);
});

test("initial form uses one idempotent request followed by sequential photo uploads", async () => {
  const form = await readFile(new URL("../components/RequestForm.tsx", import.meta.url), "utf8");
  const createRoute = await readFile(new URL("../app/api/requests/route.ts", import.meta.url), "utf8");
  assert.match(form, /submissionKey\.current \|\|= crypto\.randomUUID\(\)/);
  assert.match(form, /for \(let queueIndex = 0; queueIndex < queue\.length; queueIndex \+= 1\)/);
  assert.match(form, /messageId = await uploadAttachment\(token, prepared, messageId\)/);
  assert.match(createRoute, /request_preferences\.submission_key=\?/);
  assert.match(createRoute, /Too many recent requests/);
});

test("keeps direct SMS acquisition gated until the A2P campaign is approved", async () => {
  const homepage = await html("/");
  const homeServices = await html("/home-services");
  const siteConfig = await readFile(new URL("../lib/site-config.ts", import.meta.url), "utf8");
  assert.match(siteConfig, /directSmsInquiriesEnabled = false/);
  assert.match(siteConfig, /Hi Anchor Point One/);
  assert.match(siteConfig, /I need help with my RV/);
  assert.match(siteConfig, /I need help with a home service request/);
  assert.doesNotMatch(homepage, /href="sms:/);
  assert.doesNotMatch(homeServices, /href="sms:/);
  assert.match(homepage, /Send Service Request/);
  assert.doesNotMatch(homepage, /Book Now/);
});

test("shows approved pricing consistently", async () => {
  const homepage = await html("/");
  const rvServices = await html("/rv-services");
  const pricing = await html("/pricing-service-policy");
  for (const body of [homepage, rvServices, pricing]) {
    assert.match(body, /\$150/);
    assert.match(body, /45 minutes/);
    assert.match(body, /\$90/);
    assert.match(body, /\$22\.50/);
  }
  for (const total of ["150.00", "172.50", "195.00", "217.50", "240.00", "262.50"]) {
    assert.match(pricing, new RegExp(`\\$${total.replace(".", "\\.")}`));
  }
});

test("initial form collects the corrected fields and supports one short video", async () => {
  const form = await readFile(new URL("../components/RequestForm.tsx", import.meta.url), "utf8");
  assert.match(form, />Name<input required/);
  assert.match(form, />City<input required/);
  assert.match(form, />ZIP Code<input required/);
  assert.match(form, />Mobile Phone<input required/);
  assert.match(form, /RV Type \(if known\)/);
  assert.match(form, /video\/mp4,video\/quicktime,video\/webm/);
  assert.match(form, /Send Service Request/);
  assert.doesNotMatch(form, /Preferred Appointment Day/);
});

test("private-link follow-ups stay on the token-matched request and reopen a closed thread", async () => {
  const requestRoute = await readFile(new URL("../app/api/requests/[token]/route.ts", import.meta.url), "utf8");
  assert.match(requestRoute, /SELECT id,customer_name FROM service_requests WHERE access_token=\?/);
  assert.match(requestRoute, /INSERT INTO request_messages \(request_id,author_type,body,created_at\)/);
  assert.match(requestRoute, /status IN \('received','completed','closed'\) THEN 'in_review'/);
  assert.match(requestRoute, /sendRequestChatNotification/);
});

test("owner inbox keeps read, important, completed, search, and deletion as separate controls", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const dashboardRoute = await readFile(new URL("../app/api/admin/dashboard/route.ts", import.meta.url), "utf8");
  const requestRoute = await readFile(new URL("../app/api/admin/requests/[id]/route.ts", import.meta.url), "utf8");
  const owner = await readFile(new URL("../components/OwnerDashboard.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0009_previous_kabuki.sql", import.meta.url), "utf8");

  assert.match(schema, /ownerReadAt: integer\("owner_read_at"\)/);
  assert.match(schema, /isImportant: integer\("is_important"\)\.notNull\(\)\.default\(0\)/);
  assert.match(migration, /SET `owner_read_at`=`updated_at`/);
  assert.match(dashboardRoute, /request_messages\.author_type='customer'/);
  assert.match(dashboardRoute, /twilio_voice_calls\.created_at/);
  assert.match(dashboardRoute, /twilio_message_events\.direction LIKE 'inbound%'/);
  assert.match(dashboardRoute, /AS is_unread/);
  assert.match(owner, /Messages \(\{unreadCount\}\)/);
  assert.match(owner, /\["all", "unread", "important", "completed"\]/);
  assert.match(owner, /Name, phone, or message text/);
  assert.match(owner, /Mark as Unread/);
  assert.match(owner, /Mark Completed/);
  assert.match(owner, /including its messages and photos\? This cannot be undone/);
  assert.match(requestRoute, /export async function DELETE/);
  assert.match(requestRoute, /DELETE FROM twilio_delivery_statuses WHERE request_id=\?/);
  assert.match(requestRoute, /DELETE FROM service_requests WHERE id=\?/);
  assert.match(requestRoute, /removeStoredAttachments/);
});

test("serves private video attachments with byte-range support", async () => {
  const responseHelper = await readFile(new URL("../lib/attachment-response.ts", import.meta.url), "utf8");
  const customerRoute = await readFile(new URL("../app/api/requests/[token]/attachments/[attachmentId]/route.ts", import.meta.url), "utf8");
  const ownerRoute = await readFile(new URL("../app/api/admin/requests/[id]/attachments/[attachmentId]/route.ts", import.meta.url), "utf8");
  assert.match(responseHelper, /status: 416/);
  assert.match(responseHelper, /"accept-ranges": "bytes"/);
  assert.match(responseHelper, /headers\.set\("content-range"/);
  assert.match(responseHelper, /status: parsedRange \? 206 : 200/);
  assert.match(customerRoute, /storedAttachmentResponse/);
  assert.match(ownerRoute, /storedAttachmentResponse/);
});

test("validates detected attachment types before storage and bounds Twilio downloads", async () => {
  const attachments = await readFile(new URL("../lib/attachments.ts", import.meta.url), "utf8");
  assert.match(attachments, /prepared\.filter\(\(item\) => item\.contentType\.startsWith\("image\/"\)\)/);
  assert.match(attachments, /readBoundedResponse/);
  assert.match(attachments, /reader\.cancel\(\)/);
  assert.doesNotMatch(attachments, /response\.arrayBuffer\(\)/);
});

test("privacy copy describes the actual initial-request fields", async () => {
  const body = await html("/privacy");
  assert.match(body, /mobile phone number/);
  assert.match(body, /city/);
  assert.match(body, /ZIP code/);
  assert.match(body, /preferred contact method/);
  assert.match(body, /optional RV type or equipment details/);
  assert.match(body, /photos, short videos, messages, voicemail recordings, call metadata, and SMS consent choice/);
});

test("applies the post-update identity and navigation corrections without changing pricing", async () => {
  const homepage = await html("/");
  const privacy = await html("/privacy");
  const terms = await html("/terms");
  const pricing = await html("/pricing-service-policy");
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");

  for (const legalPage of [privacy, terms]) {
    assert.match(legalPage, /Anchor Point One/);
    assert.doesNotMatch(legalPage, /Andrei Solodkov|AnchorPoint Mobile RV &amp; Home Services/);
  }
  assert.match(homepage, /Andrei — Owner &amp; Mobile Service Technician/);
  assert.match(pricing, /href="\/"[^>]*>Back to Home<\/a>/);
  assert.match(pricing, /Diagnostic and Service Visit — \$150/);
  assert.match(pricing, /\$22\.50/);

  const labels = [
    "Home",
    "Mobile RV Services",
    "Home Services",
    "Gallery",
    "How It Works",
    "FAQ",
    "About",
    "Diagnostic and Service Visit",
    "Contact",
  ];
  for (let index = 1; index < labels.length; index += 1) {
    assert.ok(header.indexOf(`\"${labels[index - 1]}\"`) < header.indexOf(`\"${labels[index]}\"`));
  }
});

test("matches the homepage scroll order to the main navigation and closes the compact menu", async () => {
  const homepage = await html("/");
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const markers = [
    "<h2>Mobile RV Services</h2>",
    "<h2>Select Minor Home Services</h2>",
    "<h2>RV &amp; Home Service Gallery</h2>",
    "<h2>How It Works</h2>",
    "<h2>Frequently Asked Questions</h2>",
    "About Anchor Point One",
    "id=\"diagnostic-visit-price\"",
    "<h2>Not Sure What Service You Need?</h2>",
  ];

  for (let index = 1; index < markers.length; index += 1) {
    assert.ok(homepage.indexOf(markers[index - 1]) < homepage.indexOf(markers[index]));
  }
  assert.match(header, /onClick=\{onNavigate\}/);
  assert.match(header, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(header, /event\.key === "Escape"/);
});

test("voice calls create or reuse one request before the caller continues by SMS", async () => {
  const incomingVoice = await readFile(new URL("../app/api/twilio/voice/incoming/route.ts", import.meta.url), "utf8");
  const voiceSmsFollowUp = await readFile(new URL("../app/api/twilio/voice/sms-follow-up/route.ts", import.meta.url), "utf8");
  const recording = await readFile(new URL("../app/api/twilio/voice/recording/route.ts", import.meta.url), "utf8");
  const incomingSms = await readFile(new URL("../app/api/twilio/incoming/route.ts", import.meta.url), "utf8");
  const attachments = await readFile(new URL("../lib/attachments.ts", import.meta.url), "utf8");
  const owner = await readFile(new URL("../components/OwnerDashboard.tsx", import.meta.url), "utf8");
  const customer = await readFile(new URL("../components/RequestThread.tsx", import.meta.url), "utf8");

  assert.match(incomingVoice, /phone_conversations\.active_request_id/);
  assert.match(incomingVoice, /previous\?\.id \?\? await phoneRequestId\(from\)/);
  assert.match(incomingVoice, /INSERT OR IGNORE INTO twilio_voice_calls/);
  assert.match(incomingVoice, /source_channel\) VALUES/);
  assert.match(incomingVoice, /"voice"/);
  assert.doesNotMatch(incomingVoice, /INSERT(?: OR IGNORE)? INTO sms_consents/);
  assert.match(incomingVoice, /sendIncomingCallNotification/);
  assert.match(incomingVoice, /voice="Polly\.Joanna" language="en-US"/);
  assert.match(incomingVoice, /To receive a text with instructions/);
  assert.match(incomingVoice, /Service text frequency varies/);
  assert.match(incomingVoice, /reply HELP for help or STOP to opt out/);
  assert.match(incomingVoice, /SELECT request_id,opted_out_at FROM sms_consents/);
  assert.match(incomingVoice, /<Gather input="dtmf" numDigits="1"/);
  assert.match(incomingVoice, /<Redirect method="POST">/);
  assert.match(incomingVoice, /text START to this number/);
  assert.doesNotMatch(incomingVoice, /<Record/);
  assert.match(voiceSmsFollowUp, /digits === "1"/);
  assert.match(voiceSmsFollowUp, /Voice\/IVR - Press 1/);
  assert.match(voiceSmsFollowUp, /consent_call_sid/);
  assert.match(voiceSmsFollowUp, /Your text is on the way/);
  assert.match(voiceSmsFollowUp, /sms_follow_up_sent_at=-1/);
  assert.match(voiceSmsFollowUp, /outbound_voice_follow_up/);
  assert.match(voiceSmsFollowUp, /STOP to opt out/);
  const voiceFollowUpSms = voiceSmsFollowUp.match(/const FOLLOW_UP_SMS = "([^"]+)"/)?.[1] ?? "";
  assert.equal(voiceFollowUpSms, "Anchor Point One: Reply with city/ZIP, RV year/make/model, issue details & photos/video. We will review and suggest next steps. No obligation. STOP to opt out.");
  assert.ok(voiceFollowUpSms.length <= 160);
  assert.match(incomingSms, /await phoneRequestId\(from\)/);
  assert.match(incomingSms, /preferred_contact_method='text'.+source_channel='voice'/s);
  assert.match(recording, /storeTwilioRecording/);
  assert.match(recording, /INSERT INTO request_attachments/);
  assert.match(recording, /recording_status='stored'/);
  assert.match(attachments, /hostname !== "api\.twilio\.com"/);
  assert.match(owner, /<audio controls preload="metadata"/);
  assert.match(customer, /<audio controls preload="metadata"/);
});

test("voice webhooks validate exact callback URLs and retain a disabled voicemail fallback", async () => {
  const incomingVoice = await readFile(new URL("../app/api/twilio/voice/incoming/route.ts", import.meta.url), "utf8");
  const completeVoice = await readFile(new URL("../app/api/twilio/voice/complete/route.ts", import.meta.url), "utf8");
  const recording = await readFile(new URL("../app/api/twilio/voice/recording/route.ts", import.meta.url), "utf8");
  const transcription = await readFile(new URL("../app/api/twilio/voice/transcription/route.ts", import.meta.url), "utf8");

  assert.match(incomingVoice, /validateTwilioRequest\(request, parameters, webhookUrl\)/);
  assert.match(completeVoice, /validateTwilioRequest\(request, parameters, callbackUrl\)/);
  assert.match(recording, /validateTwilioRequest\(request, parameters, callbackUrl\)/);
  assert.match(transcription, /validateTwilioRequest\(request, parameters, callbackUrl\)/);
  assert.doesNotMatch(incomingVoice, /TWILIO_VOICEMAIL_TRANSCRIPTION_ENABLED/);
  assert.match(transcription, /TWILIO_VOICEMAIL_TRANSCRIPTION_ENABLED !== "true"/);
  assert.match(recording, /deleteTwilioRecording/);
});
