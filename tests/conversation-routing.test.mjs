import assert from "node:assert/strict";
import test from "node:test";

import {
  ACK_COOLDOWN_MS,
  extractRequestReference,
  phoneRequestId,
  selectConversationItem,
  shouldAutoAcknowledge,
} from "../lib/conversation-routing.ts";

test("an explicit request reference has routing priority", () => {
  assert.equal(extractRequestReference("More photos for ap-a1b2c3d4"), "A1B2C3D4");
  assert.equal(selectConversationItem({
    referencedItem: "explicit-request",
    activeItem: "active-request",
    eventItem: "latest-event-request",
    previousRequest: "previous-request",
  }), "explicit-request");
});

test("voice and SMS use one deterministic request identity for the same phone", async () => {
  const first = await phoneRequestId("+18135550123");
  const followUp = await phoneRequestId("+18135550123");
  const otherCustomer = await phoneRequestId("+18135550124");
  assert.equal(first, followUp);
  assert.notEqual(first, otherCustomer);
  assert.match(first, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
});

test("follow-ups select the active request before event and request fallbacks", () => {
  assert.equal(selectConversationItem({
    referencedItem: null,
    activeItem: "active-request",
    eventItem: "latest-event-request",
    previousRequest: "previous-request",
  }), "active-request");
  assert.equal(selectConversationItem({
    referencedItem: null,
    activeItem: null,
    eventItem: "latest-event-request",
    previousRequest: "previous-request",
  }), "latest-event-request");
  assert.equal(selectConversationItem({
    referencedItem: null,
    activeItem: null,
    eventItem: null,
    previousRequest: "previous-request",
  }), "previous-request");
});

test("only a sender without any conversation candidate needs a new request", () => {
  assert.equal(selectConversationItem({
    referencedItem: null,
    activeItem: null,
    eventItem: null,
    previousRequest: null,
  }), null);
});

test("the acknowledgement cooldown never changes conversation selection", () => {
  const now = Date.UTC(2026, 8, 13, 12);
  assert.equal(shouldAutoAcknowledge(now, 0, 0), true);
  assert.equal(shouldAutoAcknowledge(now, now - ACK_COOLDOWN_MS + 1, 0), false);
  assert.equal(shouldAutoAcknowledge(now, now - ACK_COOLDOWN_MS, now - ACK_COOLDOWN_MS), true);
  assert.equal(selectConversationItem({
    referencedItem: null,
    activeItem: "same-request-after-24-hours",
    eventItem: null,
    previousRequest: null,
  }), "same-request-after-24-hours");
});
