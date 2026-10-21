const SUCCESS_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function requiredConfig(env) {
  const config = {
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    paymentLinkId: env.STRIPE_PAYMENT_LINK_ID,
    storeName: env.DONATION_STATS_STORE || "stc-donation-events",
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => key !== "storeName" && !value)
    .map(([key]) => key);

  return { config, missing };
}

function donationRecord(event, session, now) {
  return {
    stripeEventId: event.id,
    checkoutSessionId: session.id,
    paymentLinkId: session.payment_link,
    amountTotal: session.amount_total,
    currency: session.currency,
    paymentStatus: session.payment_status,
    eventType: event.type,
    liveMode: Boolean(event.livemode),
    stripeCreatedAt: new Date(event.created * 1000).toISOString(),
    recordedAt: now().toISOString(),
  };
}

export function createWebhookHandler({ constructEvent, getStore, env = process.env, now = () => new Date() }) {
  return async function webhookHandler(request) {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { allow: "POST" } });
    }

    const { config, missing } = requiredConfig(env);
    if (missing.length) {
      console.error("Stripe webhook configuration is incomplete", { missing });
      return json(503, { received: false, error: "Webhook is not configured" });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) return json(400, { received: false, error: "Missing signature" });

    let event;
    try {
      const rawBody = await request.text();
      event = constructEvent(rawBody, signature, config.webhookSecret);
    } catch (error) {
      console.warn("Rejected Stripe webhook", { message: error.message });
      return json(400, { received: false, error: "Invalid signature or payload" });
    }

    if (!SUCCESS_EVENTS.has(event.type)) {
      return json(200, { received: true, ignored: "event_type" });
    }

    const session = event.data?.object;
    if (!session || session.payment_link !== config.paymentLinkId) {
      return json(200, { received: true, ignored: "payment_link" });
    }

    if (event.type === "checkout.session.completed" && session.payment_status !== "paid") {
      return json(200, { received: true, ignored: "payment_pending" });
    }

    const store = getStore({ name: config.storeName, consistency: "strong" });
    const key = `success/${event.id}.json`;
    const record = donationRecord(event, session, now);

    try {
      const write = await store.setJSON(key, record, { onlyIfNew: true });
      if (!write.modified) return json(200, { received: true, duplicate: true });
      return json(200, { received: true, recorded: true });
    } catch (error) {
      console.error("Stripe webhook processing failed", {
        eventId: event.id,
        message: error.message,
      });
      return json(502, { received: false, error: "Processing failed" });
    }
  };
}
