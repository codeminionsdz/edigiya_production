# EDIGIYA V2 — Phase 2 / 20260924 Implementation Report

## Status

**READY FOR LIVE VERIFICATION**

The migration is implemented locally only. It has not been applied to Supabase from this workspace.

## Implemented

Migration: `supabase/migrations/20260924_guest_digital_delivery_grants.sql`

- Added `guest_digital_delivery_grants` with opaque SHA-256 token hashes only, expiration, revocation, idempotency, and redemption metadata.
- Added `guest_digital_delivery_access_events` with one idempotent audit record per grant.
- Added trusted grant creation that validates paid, digital, delivered, allocation-backed fulfillment and current secret-version metadata.
- Extended the existing `get_digital_unit_secret_for_session` boundary with a guest-token form. It derives order/allocation identity from the token hash and accepts no guest-supplied IDs.
- Preserved the existing three-argument account function as a wrapper to the same shared Vault boundary.
- Added a POST guest delivery route with `no-store`, `no-referrer`, and generic errors.

## Security

- No guest email, SlickPay, account-linking, or UI delivery feature was implemented.
- No Vault secret was created or read.
- Tokens are generated server-side with `crypto.randomBytes`, stored only as SHA-256 hashes, and never logged or persisted in plaintext.
- Grants are tied to the exact order, item, allocation, fulfillment, paid payment, delivered state, valid unit/allocation state, and current secret-version metadata.
- Grant rows are locked during redemption; counters and audit records update atomically.
- `PUBLIC`, `anon`, and `authenticated` have no grant-table privileges or function EXECUTE. `service_role` is the trusted server boundary.
- SECURITY DEFINER functions use `SET search_path = ''` and qualified references.
- Only the opaque delivery token is intended for a future guest URL; no Vault UUID, credential, code, or secret is placed in it.

## Local validation

- `npm run build`: PASS. Existing warnings remain for deprecated `images.domains` and middleware convention.
- `npx tsc --noEmit`: existing unrelated failures only in `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and `nutrition-erp/src/...`; no 20260924 error was reported.
- Static SQL/security review: PASS; live PostgreSQL verification remains required.
- Runtime grant/redemption tests: **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**. No fake units or Vault secrets were created.

## Files changed

- `supabase/migrations/20260924_guest_digital_delivery_grants.sql`
- `lib/repositories.ts`
- `app/(store)/actions.ts`
- `app/api/digital-delivery/guest/route.ts`
- `EDIGIYA_V2_PHASE2_20260924_IMPLEMENTATION_REPORT.md`
- `EDIGIYA_V2_PHASE2_20260924_LIVE_VERIFICATION_PACKAGE.md`

Guest delivery is the only new scope. Do not implement email, SlickPay, or 20260925 before live verification.
