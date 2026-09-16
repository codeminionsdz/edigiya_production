# EDIGIYA V2 — Phase 2 — 20260918 Implementation Report

## Purpose

This slice bridges the verified Phase 1 reservation to unique digital-unit
reservation, then forward-corrects the existing 20260917 allocator so the
state flow is coherent:

`available → reserved → allocated`.

Phase 1 product/variant stock remains the projection. This migration never
decrements it a second time and does not change payment RPCs.

## Exact migration

`supabase/migrations/20260918_digital_unit_reservation_bridge.sql`

## Actual tables and relationships used

The new `public.digital_unit_reservations` table links one
`digital_inventory_units` row to one existing `inventory_reservations` row and
one existing `order_items` row, with product and nullable variant identity,
reservation slot, lifecycle status, idempotency key, and non-sensitive audit
metadata. Composite foreign keys preserve product/variant consistency.

The existing `digital_unit_allocations` table remains the order-item allocation
record created by `allocate_digital_unit`; no allocation row is created by the
reservation RPC.

## RPCs and state transitions

- `reserve_digital_units_for_reservation(...)` locks the Phase 1 reservation,
  validates the order item and reservation item quantity, selects exactly the
  requested number of matching `available` units with `FOR UPDATE SKIP LOCKED`,
  changes them to `reserved`, and inserts one bridge row per slot.
- `allocate_digital_unit(...)` is forward-corrected to require the matching
  bridge row, insert the existing allocation initially as `reserved`, then
  atomically transition the unit, bridge, and allocation to `allocated`.
- No Vault function is called and no secret value is returned or stored.

## Idempotency and concurrency

The reservation row lock serializes retries for the same Phase 1 reservation.
A committed matching operation key returns its existing complete set; a
different operation cannot replace an existing reservation for the same order
item. The active-unit partial unique index and row locks prevent a unit from
being reserved by two reservations. A failed batch rolls back all unit status
changes and bridge rows.

Allocation retains the 20260916 idempotency key and slot uniqueness. It locks
the reservation bridge and uses the existing allocation trigger/index as a
second database defense. Repeated allocation returns the existing row.

## Security boundary

Both RPCs are `SECURITY DEFINER`, use `SET search_path = ''`, and use fully
qualified objects. Table RLS is enabled and table privileges are revoked from
`PUBLIC`, `anon`, and `authenticated`; only `service_role` has table access.
Only `service_role` can execute either RPC. Trigger functions are not
customer-executable. No secret-bearing value is exposed.

## Intentionally not implemented

- No Vault secret creation/retrieval/replacement.
- No plaintext credential or code storage.
- No payment, email, fulfillment, guest delivery, account library, SlickPay,
  Telegram/Messenger, checkout UI, or Phase 1 RPC changes.
- No customer access to unit, bridge, or allocation tables.

## Local validation

- `npm run build`: **PASS**. Next.js 16.1.6 compiled and generated all routes.
- `npx tsc --noEmit`: **FAIL with the same pre-existing errors** in
  `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and
  `nutrition-erp/src/...`; no error references this migration.
- Static SQL review: **PASS**. The migration contains no Vault operation,
  plaintext secret column, Phase 1 RPC reference, second stock decrement, or
  reset behavior. Customer table privileges and function EXECUTE are revoked;
  only `service_role` is granted.

The unrelated TypeScript errors were not modified.

## Live verification required

Apply only this migration through the established Supabase process, then use
isolated QA rows marked `PHASE2_QA_20260918` and fake opaque Vault UUIDs. Verify
exact unit count, idempotent retry, final-unit concurrency, product/variant
matching, allocation transition, rollback, RLS, and Phase 1 stock unchanged.
Do not create or read a real Vault secret. Clean only QA rows afterward.

## Final status

**READY FOR LIVE VERIFICATION**

Do not start 20260919.
