# EDIGIYA V2 — Phase 2 — 20260920 Implementation Report

## Result

**BLOCKED — explain exactly why**

The live Vault metadata supplied for this slice confirms the exact
`vault.create_secret(text, text, text, uuid) returns uuid` signature. The
implementation uses that function only; it does not use `vault.update_secret`
or `vault.decrypted_secrets`.

## Repository inspection

Inspected the existing Phase 2 migrations and reports, including:

- `20260915_digital_inventory_units_foundation.sql`
- `20260916_digital_unit_allocation_foundation.sql`
- `20260917_digital_unit_allocation_rpc.sql`
- `20260918_digital_unit_reservation_bridge.sql`
- `20260919_secret_version_metadata.sql`
- `EDIGIYA_V2_PHASE2_SECRET_MANAGEMENT_REVIEW.md`
- `EDIGIYA_V2_PHASE2_VAULT_SECURITY_GATE.md`

The current local schema stores only opaque `vault_secret_id` UUIDs and version
metadata. There is no local Vault wrapper, no Vault retrieval helper, and no
customer delivery boundary.

The repository also has no guest-grant table or explicit account-to-order
ownership relation suitable for authorizing customer decryption in this slice.

## Implementation

- Added migration:
  `supabase/migrations/20260920_secure_vault_boundary.sql`
- Added server helper: `lib/vault-service.ts`
- Added metadata-only verification SQL:
  `EDIGIYA_V2_PHASE2_20260920_LIVE_VERIFICATION.sql`

The migration creates `public.create_or_replace_digital_unit_secret`, which is
callable only by `service_role`. It validates the unit and lifecycle, checks
idempotency before calling Vault, generates non-sensitive Vault name/
description values, calls the verified Vault create signature, writes version
metadata, retires the prior version, and synchronizes the unit pointer.

`lib/vault-service.ts` requires `SUPABASE_VAULT_KEY_ID` as a UUID and fails
closed if it is missing or invalid. No key fallback is used and no key value is
printed. The helper requires the service-role key and does not log or return
the plaintext secret.

The design remains:

- Vault contains the secret value;
- public tables contain only opaque Vault IDs and version metadata;
- one current version per unit;
- replacement is sequential, idempotent, auditable, and disallowed after
  allocation by default;
- old versions are retained, not silently deleted;
- no customer retrieval endpoint is created before account/grant ownership
  authorization exists.

## Runtime testing

`digital_inventory_units` is currently empty. No fake production unit/order
was created. No runtime Vault test was attempted because doing so without
confirmed signatures and an isolated QA Vault secret would be unsafe.

## Local validation

- `npm run build`: **PASS**.
- `npx tsc --noEmit`: **FAIL with pre-existing errors only** in
  `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and
  `nutrition-erp/src/...`; no error references the new helper or migration.
- Static review: **PASS** for no decrypted-view access, no `update_secret`, no
  plaintext database columns, service-role-only execution, fixed search path,
  and no Phase 1/payment changes.

## Changes made

- Added the migration, server helper, verification SQL, and this report.
- No database or Supabase mutation performed.
- No Vault secret was created or read.

## Exact next manual action

Set `SUPABASE_VAULT_KEY_ID` only after confirming the approved project key UUID
through the restricted Supabase operational process; do not fabricate it.
Then apply the migration through the established process and run the included
metadata-only verification SQL. Runtime create/replace testing requires an
isolated QA unit and QA Vault secret; it must not use production credentials.

Do not start `20260921`.
