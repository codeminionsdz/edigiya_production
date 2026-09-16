# EDIGIYA V2 — Phase 2 — 20260919 Implementation Report

## Scope and proposal decision

The existing schema has `digital_inventory_units.vault_secret_id` and
`secret_version`, but no version history table. It also has no explicit
account-to-order ownership or guest-grant table that could safely authorize a
customer decryption request. Therefore this slice implements only the safe
secret-version metadata boundary. It deliberately does not create a decrypt
RPC before the ownership/grant model exists.

## Files and migration

- `supabase/migrations/20260919_secret_version_metadata.sql`
- `EDIGIYA_V2_PHASE2_20260919_IMPLEMENTATION_REPORT.md`

## Tables and current-version model

`public.digital_unit_secret_versions` stores one opaque Vault UUID per business
secret version, its unit, version number, status (`current`, `retired`, or
`revoked`), idempotency key, and non-sensitive audit metadata. It has unique
unit/version and Vault-reference constraints, plus a partial unique index that
allows exactly one current version per unit.

The current version is determined by `status = 'current'`. The existing unit
columns remain synchronized as compatibility pointers; the raw secret is never
stored in either table.

## Version and replacement behavior

`register_digital_unit_secret_version(...)` accepts only an opaque Vault UUID,
never a secret value. It is idempotent per unit and replacement key. Version 1
can bootstrap only when it exactly matches the unit's existing opaque version-1
pointer. Replacement requires the next sequential version, a different opaque
Vault UUID, and unit status `available`; the previous current version is
retired in the same transaction before the new current version is inserted.
Allocated/consumed/reserved units cannot be silently repointed, preserving
allocation ownership and preventing stale-version replacement after allocation.
Old versions are retained for audit/recovery and are not deleted.

## Vault and delivery boundary

No Vault function or decrypted view is referenced by this migration. No Vault
secret is created or read. This is intentional: the repository currently lacks
the explicit account/order or guest-grant authorization context required for a
safe customer decryption boundary. A later delivery slice must verify paid
payment, delivered fulfillment, exact allocation, and either authenticated
account ownership or a short-lived hashed guest grant before retrieving one
current Vault value. It must return only the minimum secret and never expose
Vault metadata.

The future boundary must also keep secrets out of product/order APIs, logs,
payment events, Telegram/Messenger messages, public storage, and pre-auth HTML.

## Security model

The version table has RLS enabled, all table privileges are revoked from
`PUBLIC`, `anon`, and `authenticated`, and only `service_role` has table access.
The registration RPC is `SECURITY DEFINER`, pins `search_path` to empty,
schema-qualifies all objects, and is executable only by `service_role`.

## Intentionally not implemented

- No Vault secret creation, read, decrypt, or rotation API.
- No plaintext credentials/codes.
- No customer delivery, guest grants, account library, email, fulfillment,
  SlickPay, Telegram/Messenger, UI, or Phase 1/payment changes.
- No modification of migrations `20260915`–`20260918`.

## Local validation

- `npm run build`: **PASS**. Next.js 16.1.6 compiled and generated all routes.
- `npx tsc --noEmit`: **FAIL with pre-existing errors only** in
  `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and
  `nutrition-erp/src/...`; no error references this migration.
- Static checks: **PASS**. No Vault reads/creates, plaintext secret columns,
  customer grants, Phase 1 RPC references, reset, or destructive data
  operation exists in the migration.

The unrelated TypeScript errors were not modified.

## Runtime limitations

The live database currently has zero `digital_inventory_units`, so version
registration and replacement cannot be truthfully runtime-tested without
creating QA units. No real Vault secret or fake production inventory will be
created in this slice. Live schema/grant verification remains required.

## Status

**READY FOR LIVE VERIFICATION**

Do not start 20260920.
