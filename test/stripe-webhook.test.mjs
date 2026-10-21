import assert from "node:assert/strict";
import test from "node:test";

import { createWebhookHandler } from "../netlify/functions/_lib/stripe-webhook-core.mjs";

const env = {
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PAYMENT_LINK_ID: "plink_stc",
  RESEND_API_KEY: "re_test",
  DONATION_NOTIFICATION_TO: "martin@sonictoniccollective.com",
  DONATION_NOTIFICATION_FROM: "STC <donations@sonictoniccollective.com>",
};

function event(overrides = {}) {
  return {
    id: "evt_123",
    type: "checkout.session.completed",
    created: 1792531200,
    livemode: true,
    data: {
      object: {
        id: "cs_123",
        payment_link: "plink_stc",
        amount_total: 2500,
        currency: "eur",
        payment_status: "paid",
      },
    },
    ...overrides,
  };
}

function harness(stripeEvent = event()) {
  const records = new Map();
  const emails = [];
  const store = {
    async setJSON(key, value, options = {}) {
      if (options.onlyIfNew && records.has(key)) return { modified: false };
      records.set(key, structuredClone(value));
      return { modified: true, etag: `etag-${records.size}` };
    },
    async get(key) {
      return structuredClone(records.get(key) ?? null);
    },
  };
  const handler = createWebhookHandler({
    constructEvent: () => stripeEvent,
    getStore: () => store,
    fetchFn: async (url, options) => {
      emails.push({ url, options });
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    },
    env,
    now: () => new Date("2026-10-21T12:00:00.000Z"),
  });
  return { handler, records, emails };
}

function request() {
  return new Request("https://example.com/.netlify/functions/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=test" },
    body: "{}",
  });
}

test("records a paid STC donation and sends one notification", async () => {
  const { handler, records, emails } = harness();
  const response = await handler(request());

  assert.equal(response.status, 200);
  assert.equal(records.size, 1);
  assert.equal(emails.length, 1);
  const stored = [...records.values()][0];
  assert.equal(stored.amountTotal, 2500);
  assert.equal(stored.currency, "eur");
  assert.equal(stored.emailStatus, "sent");
  assert.equal("customer_details" in stored, false);
  assert.equal(emails[0].options.headers["idempotency-key"], "stc-donation-evt_123");
});

test("does not notify twice for the same Stripe event", async () => {
  const { handler, emails } = harness();
  assert.equal((await handler(request())).status, 200);
  const duplicate = await handler(request());

  assert.equal(duplicate.status, 200);
  assert.equal(emails.length, 1);
  assert.equal((await duplicate.json()).duplicate, true);
});

test("ignores an unpaid completed session until asynchronous success", async () => {
  const stripeEvent = event();
  stripeEvent.data.object.payment_status = "unpaid";
  const { handler, records, emails } = harness(stripeEvent);
  const response = await handler(request());

  assert.equal(response.status, 200);
  assert.equal(records.size, 0);
  assert.equal(emails.length, 0);
});

test("accepts async payment success", async () => {
  const stripeEvent = event({ type: "checkout.session.async_payment_succeeded" });
  const { handler, records, emails } = harness(stripeEvent);
  const response = await handler(request());

  assert.equal(response.status, 200);
  assert.equal(records.size, 1);
  assert.equal(emails.length, 1);
});

test("ignores payments from another Payment Link", async () => {
  const stripeEvent = event();
  stripeEvent.data.object.payment_link = "plink_other";
  const { handler, records, emails } = harness(stripeEvent);
  const response = await handler(request());

  assert.equal(response.status, 200);
  assert.equal(records.size, 0);
  assert.equal(emails.length, 0);
});

test("rejects invalid Stripe signatures", async () => {
  const { handler } = harness();
  const invalidHandler = createWebhookHandler({
    constructEvent: () => {
      throw new Error("bad signature");
    },
    getStore: () => {
      throw new Error("must not be reached");
    },
    env,
  });

  assert.equal((await invalidHandler(request())).status, 400);
  assert.equal((await handler(new Request("https://example.com", { method: "GET" }))).status, 405);
});
