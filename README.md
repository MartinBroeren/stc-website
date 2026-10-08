# Sonic Tonic Collective website

Sprint 0 is STC's permanent gateway: a minimal landing page with stable public redirect routes.

## Hosting

The site is a provider-neutral static site configured for Netlify.

- Publish directory: `public`
- Build command: none
- Redirects and security headers: `netlify.toml`
- TLS certificates: managed by Netlify

## Maintain redirects

Edit the matching `[[redirects]]` entry in `netlify.toml`, commit the change, and push it to `main`.

Redirects intentionally use HTTP 302. The public STC route stays permanent while the external destination remains replaceable.

Current public routes:

- `/tickets`
- `/events`
- `/signup`
- `/community`
- `/join`
- `/opendecks`
- `/instagram`
- `/youtube`
- `/mixcloud`
- `/donate`

## Architecture

- Static HTML and embedded brand assets
- No database, CMS, cookies, analytics, authentication, or client-side JavaScript
- CSS-only movement with reduced-motion support
- Security headers applied by Netlify

