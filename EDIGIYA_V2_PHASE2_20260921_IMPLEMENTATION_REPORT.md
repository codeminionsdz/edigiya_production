# EDIGIYA V2 — Phase 2 — 20260921 Implementation Report

## Scope

Implemented only the secure digital delivery authorization boundary. No email,
guest grants, account library, UI, SlickPay, Telegram/Messenger, fulfillment
automation, or Phase 1/payment change was made.

## Files changed

- `supabase/migrations/20260921_secure_digital_delivery_boundary.sql`
- `lib/vault-service.ts`
- `EDIGIYA_V2_PHASE2_20260921_LIVE_VERIFICATION_PACKAGE.md`
- this report

## Boundary

`public.get_digital_unit_secret_for_session(order_id, allocation_id,
session_id)` is a `SECURITY DEFINER` function with an empty fixed search path.
It accepts relational identifiers only; it never accepts an arbitrary
`vault_secret_id`. It verifies:

- digital order exists and matches the signed customer session;
- order item belongs to the order;
- payment status is `paid`;
- fulfillment status is `delivered`;
- allocation belongs to the order item and is `allocated` or `consumed`;
- unit belongs to the allocation, matches product/variant, and is not disabled
  or revoked;
- the selected version is the unit's one current version and its opaque Vault
  reference matches the unit pointer.

Only the exact `decrypted_secret` value is returned by this narrow backend
operation. No Vault metadata is returned. The TypeScript helper uses the
service-role client, validates UUID inputs, returns generic errors, and never
logs the secret. It is not imported by client components.

## Grants and RLS

The function revokes EXECUTE from `PUBLIC`, `anon`, and `authenticated`, and
grants only `service_role`. Existing RLS and grants on the digital unit,
allocation, version, and fulfillment tables are unchanged. The Vault schema is
not exposed by this migration.

## Guest/account boundary

This slice uses the existing signed `customer_auth` session ownership model.
Guest delivery grants are not implemented. A later grant path must call a
separate server operation that verifies a hashed, short-lived, revocable grant
bound to the same order/allocation; it must not infer ownership from email.

## Plaintext exposure

The secret is read only inside the service-role-only function and returned only
to the server helper. It is not stored in Edigiya tables, order/payment rows,
events, logs, URLs, Telegram/Messenger, public storage, generic APIs, or HTML
before authorization. Retired versions cannot be selected.

## Runtime status

`digital_inventory_units` is currently empty. No production or fake inventory
was created, and no Vault secret was created/read. Therefore runtime secret
retrieval is **NOT TESTABLE** in this pass. Live metadata and isolated QA
verification remain required.

## Local validation

- `npm run build`: **PASS**. Next.js 16.1.6 compiled and generated all routes.
- `npx tsc --noEmit`: **FAIL with pre-existing errors only** in
  `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and
  `nutrition-erp/src/...`; no error references this migration or helper.
- Static review: **PASS** for fixed empty `search_path`, service-role-only
  execute, no arbitrary Vault ID input, no client import, no secret logging,
  and no Phase 1/payment references.

The unrelated TypeScript errors were not modified.

## Status

**READY FOR LIVE VERIFICATION**

Do not start `20260922`.
