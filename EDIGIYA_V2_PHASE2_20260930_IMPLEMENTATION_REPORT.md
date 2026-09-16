# Edigiya V2 — 20260930 Production Email Provider Integration

## Status

**READY FOR LIVE VERIFICATION**

## Provider and boundary

- Provider adapter: Resend via the native server-side `fetch` API.
- Provider selection: `EMAIL_PROVIDER=resend`; client input cannot select a provider.
- Required configuration for Resend: `RESEND_API_KEY`, `EMAIL_FROM`.
- Optional configuration: `EMAIL_REPLY_TO`.
- Existing application configuration also requires `NEXT_PUBLIC_SITE_URL` and `GUEST_DELIVERY_TOKEN_SECRET` for guest delivery links.
- When provider configuration is absent, the existing worker records a controlled failure and never marks the job sent.

The worker still owns claim/lease/retry behavior and calls the provider only after claiming an outbox job. Provider success is followed by `markDigitalEmailOutboxSent`; failures use the existing bounded retry/failure path. The outbox remains the source of truth.

## Templates and security

Existing guest and account transactional templates now support French and Arabic based on the safe outbox locale metadata when present. Guest links reuse the existing grant/token mechanism and point to `/digital-delivery`; account messages point to the existing account/library experience. No plaintext credential, code, Vault value, Vault UUID or raw token is included in email payloads or logs.

The Resend API key is read only on the server. Provider errors are reduced to safe internal error codes and response bodies are not logged. No checkout, fulfillment, admin, payment, inventory, allocation, reservation or Vault function was changed.

## Files changed

- `lib/email-provider.ts` — Resend adapter and environment-gated provider selection.
- `lib/digital-email-worker.ts` — localized safe templates and escaped guest links; existing outbox state machine retained.

No migration was required. No real email was sent.

## Validation

- `npm run build`: **PASS**.
- `npx tsc --noEmit`: only pre-existing errors in `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and `nutrition-erp/src/...`; no new errors from 20260930.
- `git diff --check`: **PASS**.
- `npm run lint`: existing project-level failure because the script invokes `next lint`, which Next.js 16 treats as a project path. Lint tooling was not changed.
- Static review: no provider secret is hardcoded or client-imported; no email logs contain payloads or secrets; no Vault or guest token values are placed in metadata.

## Runtime verification

The environment currently has no `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, or `EMAIL_REPLY_TO` configured. Therefore controlled provider success/failure and duplicate-worker delivery tests are:

**NOT RUNTIME TESTABLE — EMAIL PROVIDER NOT CONFIGURED**

No fake credentials, fake units, Vault secrets, or real emails were created/sent.

