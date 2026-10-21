import { getStore } from "@netlify/blobs";
import Stripe from "stripe";

import { createWebhookHandler } from "./_lib/stripe-webhook-core.mjs";

// The Stripe SDK requires a key when instantiated, but signature verification
// uses only STRIPE_WEBHOOK_SECRET and makes no Stripe API request.
const stripe = new Stripe("sk_test_webhook_signature_verification_only");

export default createWebhookHandler({
  constructEvent: (rawBody, signature, webhookSecret) =>
    stripe.webhooks.constructEvent(rawBody, signature, webhookSecret),
  getStore,
});
