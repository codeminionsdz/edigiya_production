# EDIGIYA V2 — Phase 2 / 20260925 Email Delivery Foundation

## Status

**READY FOR LIVE VERIFICATION**

Implemented locally only. No migration was applied and no email was sent.

## Delivered

Migration: `supabase/migrations/20260925_digital_email_outbox.sql`

- Added `digital_email_outbox` with order/item, recipient, supported email type, safe JSON payload, status, retries, lease token, timestamps, last error, and idempotency key.
- Added idempotent enqueue RPC. It accepts only `guest_digital_delivery` or `account_digital_delivery`, requires paid digital delivered fulfillment, derives the email from the persisted order snapshot, and requires an explicit account/session relationship for account mail. It does not accept or store delivery tokens.
- Added worker claim RPC using `FOR UPDATE SKIP LOCKED` and a lease token.
- Added lease-checked sent/failed completion RPCs with retry scheduling and bounded error storage.
- Added service-role-only repository wrappers. No provider integration or send operation exists.

## Security and consistency

- Payload constraint rejects secret-bearing top-level keys including credentials, codes, Vault IDs, decrypted values, and tokens.
- The outbox contains no guest token, Vault secret, credential, code, or decrypted value.
- `PUBLIC`, `anon`, and `authenticated` have no table access or function EXECUTE; only `service_role` is granted.
- SECURITY DEFINER functions use `SET search_path = ''` and qualified references.
- Idempotency is unique and logical identity is checked on replay. Worker leases prevent stale concurrent workers from marking another attempt sent/failed.
- Fulfillment readiness is checked before enqueue; payment creation/pending state alone cannot create a digital email job.
- Guest grants and account library remain the existing 20260924/20260923 mechanisms; this phase does not duplicate either mechanism.

## Validation

- `npm run build`: PASS. Existing Next.js warnings remain for deprecated `images.domains` and middleware convention.
- `npx tsc --noEmit`: existing unrelated failures only in `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and `nutrition-erp/src/...`; no 20260925 error was reported.
- Static security review: PASS.
- Runtime delivery tests: **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**. No fake units, Vault secrets, or real emails were used.

## Files changed

- `supabase/migrations/20260925_digital_email_outbox.sql`
- `lib/repositories.ts`
- `EDIGIYA_V2_PHASE2_20260925_IMPLEMENTATION_REPORT.md`
- `EDIGIYA_V2_PHASE2_20260925_LIVE_VERIFICATION_PACKAGE.md`

Do not configure a provider, send email, implement SlickPay, or start 20260926 before live verification.
