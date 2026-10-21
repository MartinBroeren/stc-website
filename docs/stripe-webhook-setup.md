# Stripe donation webhook

The function at `/.netlify/functions/stripe-webhook` records each successful STC donation as one anonymous JSON record in the Netlify Blobs store `stc-donation-events`. It also sends a notification to `martin@sonictoniccollective.com` through Resend.

The record contains only the Stripe event ID, Checkout Session ID, Payment Link ID, amount, currency, payment status, event type and timestamps. It does not store a donor name, email address, IP address or card details.

## Required Netlify environment variables

- `STRIPE_WEBHOOK_SECRET`: the endpoint signing secret beginning with `whsec_`
- `STRIPE_PAYMENT_LINK_ID`: the STC Payment Link ID beginning with `plink_`
- `RESEND_API_KEY`: the Resend API key beginning with `re_`
- `DONATION_NOTIFICATION_TO`: `martin@sonictoniccollective.com`
- `DONATION_NOTIFICATION_FROM`: a sender on a domain verified in Resend, for example `Sonic Tonic Collective <donations@sonictoniccollective.com>`

Do not commit any of these secrets to GitHub.

## Stripe setup

1. Deploy the branch as a Netlify Deploy Preview and test with Stripe test mode.
2. In Stripe Workbench, create a webhook destination for the production URL.
3. Use `https://www.sonictoniccollective.com/.netlify/functions/stripe-webhook` as the endpoint.
4. Subscribe only to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
5. Copy the live endpoint signing secret to Netlify as `STRIPE_WEBHOOK_SECRET`.

The handler verifies Stripe's signature against the unmodified request body, filters events to the configured STC Payment Link and uses the Stripe event ID for duplicate protection.
