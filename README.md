# Anchor Point One

Customer service website and Owner Desk for **Anchor Point One**, a mobile RV and minor home-service business.

Live site: [anchorpoint.help](https://anchorpoint.help)

## What this repository contains

- public service pages, pricing, FAQ, privacy, and terms
- customer service-request form
- private request chat with photo and short-video uploads
- Owner Desk inbox with Read/Unread, Important, Completed, Search, and Delete controls
- Twilio SMS/MMS intake and delivery-status tracking
- incoming-call IVR with auditable Press 1 SMS consent
- deterministic routing that keeps calls, SMS/MMS, and follow-ups from the same customer in the same active request
- email notifications through Resend
- Cloudflare D1 data and R2 attachment storage

## Technology

- Next.js / Vinext
- TypeScript
- Cloudflare Workers, D1, and R2
- Drizzle ORM
- Twilio Messaging and Voice
- Resend
- ChatGPT Sites hosting

## Local setup

Prerequisites:

- Node.js 22.13 or newer
- npm
- Linux tooling used by the provided build scripts

Install and verify:

```bash
npm ci
npm run lint
npm test
```

Start local development:

```bash
npm run dev
```

## Runtime configuration

The production deployment uses platform-managed bindings and secrets. Do not commit real values.

Expected bindings include:

- `DB` and optional `BUCKET`
- `ADMIN_EMAILS`
- `RESEND_API_KEY`
- `NOTIFICATION_EMAIL_TO`
- `NOTIFICATION_EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`
- Twilio status, messaging, voice, recording, and transcription webhook URLs
- Twilio feature flags defined in `lib/database.ts`

## Deployment note

The live production site is currently managed by ChatGPT Sites. This GitHub repository is the portable source-code copy for collaboration, version review, and future deployment workflows. Pushing to this repository does **not** automatically update the live site unless a separate deployment connection is configured.

## Important compliance note

Keep the Twilio implementation aligned with the approved A2P campaign and documented consent flow. Do not add URLs to outbound SMS or change opt-in behavior without reviewing the active campaign registration first.
