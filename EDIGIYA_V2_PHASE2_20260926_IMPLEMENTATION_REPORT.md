# EDIGIYA V2 — Phase 2 / 20260926 Email Worker Report

## Status

**READY FOR LIVE VERIFICATION**

Implemented locally only. No provider credentials were added and no email was sent.

## Implemented

- Added `supabase/migrations/20260926_email_worker_lease_recovery.sql`.
- Updated `claim_digital_email_outbox_job` to reclaim only processing jobs whose lease has expired, while retaining `FOR UPDATE SKIP LOCKED`.
- Added provider-neutral `DigitalEmailProvider` / `EmailMessage` boundary in `lib/email-provider.ts`.
- Added server-only `processOneDigitalEmailJob` in `lib/digital-email-worker.ts`.
- Worker claims jobs, builds safe guest/account messages, uses the existing 20260924 guest grant and 20260923 account path, respects lease tokens, applies bounded exponential retry scheduling, and marks sent only after provider success.
- When no provider is configured, the worker records a safe failure and never marks a job sent.
- Guest grant tokens are deterministic HMAC outputs of the job/allocation identity using mandatory server-only `GUEST_DELIVERY_TOKEN_SECRET`; the raw token is used only in the transient secure link and is never logged or placed in the outbox.
- Added repository wrappers for guest context and outbox worker operations.

## Intentionally not implemented

No Resend, SendGrid, SMTP, provider credentials, public worker trigger, SlickPay, payment/inventory/Vault changes, new token mechanism, fake inventory, Vault secret creation/read, or real email delivery.

## Security guarantees

- Email builder receives only outbox metadata and generated secure links; it never receives Vault plaintext or credentials.
- Outbox payload remains secret-free.
- Provider selection is server-only and never client-controlled.
- Stale workers cannot mark another worker's lease sent/failed.
- Attempts are bounded at five; exhausted jobs remain auditable and are scheduled outside the retry window.
- Existing payment, reservation, allocation, fulfillment, account delivery, and guest delivery mechanisms are not otherwise changed.

## Validation

- `npm run build`: PASS.
- `npx tsc --noEmit`: existing unrelated errors only in `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and `nutrition-erp/src/...`; no 20260926 error was reported.
- Static security review: PASS.
- Runtime email/digital delivery tests: **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**. No fake units, Vault secrets, or emails were used.

## Files changed

- `supabase/migrations/20260926_email_worker_lease_recovery.sql`
- `lib/repositories.ts`
- `lib/email-provider.ts`
- `lib/digital-email-worker.ts`
- `app/api/digital-delivery/guest/route.ts`
- `EDIGIYA_V2_PHASE2_20260926_IMPLEMENTATION_REPORT.md`
- `EDIGIYA_V2_PHASE2_20260926_LIVE_VERIFICATION_PACKAGE.md`

Do not configure a provider, send real email, or start 20260927 before live verification.
