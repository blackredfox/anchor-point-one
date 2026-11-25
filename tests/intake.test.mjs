import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";


test("local intake routes gate voice SMS and keep one AP conversation per phone", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const DB = {
    prepare(sql) {
      const stmt = () => sqlite.prepare(sql);
      function bind(...values) {
        return {
          bind,
          async first() { return stmt().get(...values) ?? null; },
          async all() { return { results: stmt().all(...values) }; },
          async run() {
            const result = stmt().run(...values);
            return { meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
          },
        };
      }
      return bind();
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };

  const origin = "https://anchorpoint.help";
  const phone = "+18135550161";
  const secondPhone = "+18135550162";
  const callerSid = "CA" + "2".repeat(32);
  const voiceUrl = "/api/twilio/voice/incoming";
  const speechUrl = "/api/twilio/voice/sms-follow-up";
  const smsUrl = "/api/twilio/incoming";
  const sent = [];
  const stored = new Map();
  let failCleanup = false;
  const env = {
    DB,
    ADMIN_EMAILS: "owner@example.test",
    BUCKET: {
      async put(key, bytes) { stored.set(key, bytes); },
      async delete(keys) {
        if (failCleanup) throw new Error("Simulated storage failure");
        for (const key of [].concat(keys)) stored.delete(key);
      },
    },
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    TWILIO_AUTH_TOKEN: "local-test-token",
    TWILIO_ACCOUNT_SID: "local-test-account",
    TWILIO_FROM_NUMBER: "+18135550100",
    TWILIO_WEBHOOK_URL: origin + smsUrl,
    TWILIO_VOICE_WEBHOOK_URL: origin + voiceUrl,
    NOTIFICATION_SMS_TO: "+18135550199",
    NOTIFICATION_EMAIL_TO: "owner@example.test",
    NOTIFICATION_EMAIL_FROM: "site@example.test",
    RESEND_API_KEY: "local-test-key",
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const body = options?.body ?? (url instanceof Request ? await url.text() : undefined);
    sent.push({ url: url instanceof Request ? url.url : url, body });
    return Response.json({ sid: "SM" + "9".repeat(32) });
  });
  const { default: worker } = await import("../dist/server/index.js");
  const context = { waitUntil() {}, passThroughOnException() {} };
  const post = (path, headers, payload) => worker.fetch(new Request(origin + path, {
    method: "POST", headers, body: payload,
  }), env, context);
  const webhook = (path, values, valid = true) => {
    const payload = Object.keys(values).sort().reduce((value, key) => value + key + values[key], origin + path);
    const signature = createHmac("sha1", env.TWILIO_AUTH_TOKEN).update(payload).digest("base64");
    return post(path, { "x-twilio-signature": valid ? signature : "invalid" }, new URLSearchParams(values));
  };
  const count = (table) => sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  const form = (value) => post("/api/requests", { "content-type": "application/json" }, JSON.stringify({
    name: "Local Test", description: "My refrigerator is not cooling.", submissionKey: crypto.randomUUID(), ...value,
  }));

  assert.equal((await webhook(voiceUrl, { CallSid: callerSid, From: phone }, false)).status, 403);
  const baseline = await webhook(voiceUrl, { CallSid: callerSid, From: phone });
  assert.match(await baseline.text(), /Please visit anchorpoint\.help/);
  assert.equal(count("service_requests"), 0);
  assert.equal(sent.length, 0);
  const junkSid = "SM" + "0".repeat(32);
  await webhook(smsUrl, { MessageSid: junkSid, From: phone, Body: "x" });
  assert.equal(count("service_requests"), 0);

  const key = crypto.randomUUID();
  const first = await form({ phone, submissionKey: key });
  assert.equal(first.status, 201);
  const credentials = await first.json();
  assert.match(credentials.uploadToken, /^[a-f0-9]{48}$/);
  assert.equal(credentials.accessToken, undefined);
  const photo = new FormData();
  photo.append("photos", new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)], { type: "image/png" }), "sample.png");
  assert.equal((await post(`/api/requests/${credentials.uploadToken}/photos`, {}, photo)).status, 201);
  assert.equal(stored.size, 1);
  assert.equal(count("request_attachments"), 1);
  assert.equal((await form({ phone, submissionKey: key })).status, 200);
  const sms = { MessageSid: "SM" + "1".repeat(32), From: phone, Body: "My RV has no 12V power." };
  await webhook(smsUrl, sms);
  await webhook(smsUrl, sms);
  assert.equal(count("service_requests"), 1);
  assert.equal(count("request_messages"), 2);
  assert.equal(sent.length, 2, JSON.stringify(sqlite.prepare("SELECT * FROM intake_owner_notifications").all()));
  assert.equal(sent.filter((item) => String(item.url).includes("api.resend.com")).length, 1);

  env.TWILIO_SPOKEN_INTAKE_ENABLED = "true";
  const spokenSid = "CA" + "3".repeat(32);
  const call = { CallSid: spokenSid, From: secondPhone };
  const gather = await webhook(voiceUrl, call);
  assert.match(await gather.text(), /Gather input="speech"/);
  const yes = { ...call, SpeechResult: "yes", Confidence: "0.97" };
  await webhook(speechUrl, yes);
  await webhook(speechUrl, yes);
  assert.equal(count("service_requests"), 1);
  assert.equal(sent.length, 3);
  const link = new URLSearchParams(sent[2].body).get("Body").match(/\/intake\/([a-f0-9]{48})/)?.[1];
  assert.ok(link);
  const callKey = crypto.randomUUID();
  assert.equal((await form({ callToken: link, submissionKey: callKey })).status, 201);
  assert.equal((await form({ callToken: link, submissionKey: callKey })).status, 200);
  assert.equal((await form({ callToken: link, description: "The freezer is also warm." })).status, 201);
  assert.equal(count("service_requests"), 2);
  assert.equal(count("request_messages"), 4);
  assert.equal(sent.length, 5);

  const repeat = { CallSid: "CA" + "4".repeat(32), From: secondPhone };
  await webhook(voiceUrl, repeat);
  await webhook(speechUrl, { ...repeat, SpeechResult: "yes", Confidence: "0.97" });
  assert.equal(sent.length, 5);
  const stoppedPhone = "+18135550163";
  await webhook(smsUrl, { MessageSid: "SM" + "2".repeat(32), From: stoppedPhone, Body: "STOP" });
  const stopped = { CallSid: "CA" + "5".repeat(32), From: stoppedPhone };
  await webhook(voiceUrl, stopped);
  await webhook(speechUrl, { ...stopped, SpeechResult: "yes", Confidence: "0.97" });
  assert.equal(sent.length, 5);
  assert.equal(count("service_requests"), 2);

  const unansweredPhone = "+18135550164";
  for (let index = 0; index < 3; index += 1) {
    const unanswered = { CallSid: "CA" + String(index + 6).repeat(32), From: unansweredPhone };
    await webhook(voiceUrl, unanswered);
    await webhook(speechUrl, { ...unanswered, SpeechResult: "yes", Confidence: "0.40" });
  }
  await webhook(smsUrl, { MessageSid: "SM" + "6".repeat(32), From: unansweredPhone, Body: "My RV has no 12V power." });
  assert.equal(count("service_requests"), 2);
  assert.equal(sent.length, 5);
  const auth = { "oai-authenticated-user-email": "owner@example.test" };
  const dashboard = await worker.fetch(new Request(origin + "/api/admin/dashboard", { headers: auth }), env, context);
  assert.equal(dashboard.status, 200);
  const dashboardBody = await dashboard.json();
  assert.ok(dashboardBody.unverified.some((entry) => entry.phone === unansweredPhone && entry.quarantined));

  const firstId = sqlite.prepare("SELECT id FROM service_requests WHERE phone=?").get(phone).id;
  const otherId = sqlite.prepare("SELECT id FROM service_requests WHERE phone=?").get(secondPhone).id;
  const thread = (requestId) => sqlite.prepare("SELECT id FROM request_messages WHERE request_id=? ORDER BY id").all(requestId).map((message) => message.id);
  const deleteMessages = (credentials, ids) => worker.fetch(new Request(origin + `/api/admin/requests/${firstId}/messages`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...credentials },
    body: JSON.stringify({ messageIds: ids }),
  }), env, context);
  const selected = thread(firstId);
  const unselected = thread(otherId);
  assert.equal((await deleteMessages({}, selected)).status, 403);
  assert.equal((await deleteMessages(auth, unselected)).status, 409);
  failCleanup = true;
  const deletion = await deleteMessages(auth, [selected[0]]);
  assert.equal(deletion.status, 200);
  assert.equal((await deletion.json()).attachmentCleanup, "pending");
  assert.deepEqual(thread(firstId), [selected[1]]);
  assert.equal(count("request_attachments"), 0);
  assert.equal(stored.size, 1);
  assert.equal(count("attachment_cleanup_queue"), 1);
  failCleanup = false;
  const cleanup = await post(`/api/admin/requests/${firstId}/messages`, auth);
  assert.equal((await cleanup.json()).attachmentCleanup, "complete");
  assert.equal(stored.size, 0);
  const list = await worker.fetch(new Request(origin + `/api/admin/requests/${firstId}/messages`, { headers: auth }), env, context);
  assert.equal(list.status, 200);
  const allSelected = (await list.json()).messageIds;
  assert.deepEqual(allSelected, [selected[1]]);
  await webhook(smsUrl, { MessageSid: "SM" + "7".repeat(32), From: phone, Body: "Still no power." });
  const newMessageId = thread(firstId).at(-1);
  assert.equal((await deleteMessages(auth, allSelected)).status, 200);
  assert.deepEqual(thread(firstId), [newMessageId]);
  assert.deepEqual(thread(otherId), unselected);
  assert.equal(count("service_requests"), 2);
});
