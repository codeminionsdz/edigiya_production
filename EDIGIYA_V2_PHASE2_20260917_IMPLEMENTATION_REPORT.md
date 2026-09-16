# EDIGIYA V2 — Phase 2 — 20260917 Implementation Report

## Scope

This slice adds one server-side allocation primitive on top of the verified
`20260915` unit foundation and `20260916` allocation foundation. It does not
implement customer delivery, guest grants, account library, email, Vault
retrieval, payment changes, fulfillment, SlickPay, or UI changes.

## Exact migration

`supabase/migrations/20260917_digital_unit_allocation_rpc.sql`

## Architecture requirement addressed

`public.allocate_digital_unit` implements the first atomic step of:

`ORDER → RESERVATION → UNIQUE UNIT ALLOCATION`.

The RPC derives product and variant identity from the existing `order_items`
row, verifies that the supplied reservation belongs to the order and matches
the reserved item quantity, selects one matching available unit, marks it
`reserved`, and creates one `digital_unit_allocations` row.

Phase 1 stock is not decremented or incremented by this migration. The Phase 1
checkout reservation remains the stock projection and this RPC does not create
a competing stock system or double-decrement stock.

## Schema/RPC changes

No tables or columns are added. The migration creates or replaces only:

- `public.allocate_digital_unit(UUID, UUID, UUID, INTEGER, TEXT)`

It returns only allocation metadata: allocation ID, opaque digital unit ID,
status, and allocation slot. It does not return `vault_secret_id` or any
secret value.

## Idempotency and concurrency

- A matching existing `idempotency_key` returns the original allocation.
- Reusing a key with different order/item/reservation/slot is rejected.
- Existing order-item/slot rows are never silently replaced.
- Matching units are selected in deterministic order with `FOR UPDATE SKIP
  LOCKED`.
- The unit status update and allocation insert share one database transaction.
- The `20260916` partial unique index and validation trigger remain final
  database defenses against duplicate active allocation.
- A failed insert or later transaction error rolls back the unit status and
  allocation together.

## Security boundary

The function is `SECURITY DEFINER`, pins `search_path` to empty, uses
schema-qualified objects, and validates all order/reservation relationships.
EXECUTE is revoked from `PUBLIC`, `anon`, and `authenticated`; only
`service_role` receives EXECUTE. No Vault function is called and no plaintext
credential/code is stored or returned.

## What is intentionally not implemented

- No payment or Phase 1 RPC changes.
- No release/consume integration; those remain the next lifecycle slice.
- No Vault secret creation, retrieval, or replacement.
- No guest delivery grants or account library.
- No fulfillment, email, SlickPay, Telegram/Messenger, or UI changes.

## Local validation

- `npm run build`: **PASS**. Next.js 16.1.6 compiled and generated all routes.
- `npx tsc --noEmit`: **FAIL with pre-existing errors only** in
  `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and
  `nutrition-erp/src/...`. No error references this migration or the new RPC.
- Static SQL review: **PASS** for fixed `search_path`, schema-qualified
  objects, service-role-only EXECUTE, no Vault reads/creates, no plaintext
  secret handling, and no Phase 1 RPC references.

The existing TypeScript errors were not modified.

## Live verification required

This migration is local only until it is applied and verified against the live
Supabase project. Required QA uses only disposable rows marked
`PHASE2_QA_20260917` and fake opaque UUID references; no Vault secret may be
created or read. Verify valid allocation, duplicate unit/slot/idempotency
rejection, legal/illegal lifecycle behavior through the existing allocation
constraints, rollback, customer-role denial, service-role access, and Phase 1
regression. Clean all QA rows afterward.

No live application or live verification was performed in this slice.

## Status

**READY FOR LIVE VERIFICATION**
