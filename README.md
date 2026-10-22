# Sonic Tonic Collective website

The production site is a static Netlify site for Sonic Tonic Collective.

## Hosting

- Publish directory: `public`
- Build command: none
- Redirects and security headers: `netlify.toml`
- TLS certificates: managed by Netlify
- Stripe webhook: `netlify/functions/stripe-webhook.mjs`

## Public pages

- `/`
- `/donate`
- `/privacy`
- `/cookies` redirects to `/privacy`

The donation page embeds Stripe only after the visitor permits payments and fraud prevention. Consent is remembered in the necessary first-party cookie `stc_privacy_preferences`.

## External redirect routes

- `/tickets`
- `/events`
- `/signup`
- `/community`
- `/join`
- `/opendecks`
- `/instagram`
- `/youtube`
- `/mixcloud`

Redirects intentionally use HTTP 302. The public STC routes remain stable while external destinations can change.
