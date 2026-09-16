# Phase 2 — 20260916 Digital Unit Allocation Foundation

## Scope completed

Implemented only the allocation foundation after verified migration
`20260915_digital_inventory_units_foundation.sql`.

No allocation RPC, Vault retrieval, customer delivery, guest grants, account
library, email, SlickPay, or Phase 1 RPC change was made.

## File changed

- `supabase/migrations/20260916_digital_unit_allocation_foundation.sql`

## Schema created

`public.digital_unit_allocations` contains:

- one digital unit reference;
- one order and one order item reference;
- one Phase 1 reservation reference;
- product and optional variant identity;
- `allocation_slot` for deterministic per-order-item idempotency;
- states `reserved`, `allocated`, `consumed`, `released`, `revoked`;
- unique idempotency key;
- timestamps for reservation, allocation, consumption, release, and revocation;
- non-sensitive actor/note/metadata fields only.

Additional composite keys support product-consistent foreign keys:

- `order_items(id, product_id)`;
- `digital_inventory_units(id, product_id)`;
- allocation references to both composite keys;
- optional variant reference to `product_variants(id, product_id)`.

The validation trigger additionally checks the nullable variant relationship,
order/order-item relationship, reservation/order relationship, initial state,
unit status compatibility, and legal allocation transitions. This closes the
NULL loophole that a composite foreign key alone cannot close.

## Uniqueness and concurrency foundation

- One active/consumed allocation per digital unit via a partial unique index.
- One allocation per order-item/slot via a unique constraint.
- One allocation per idempotency key via a unique constraint.
- Unit row is locked by the validation trigger during allocation writes.

The actual allocator and its end-to-end concurrency behavior are intentionally
not implemented in this slice and require live verification in the next step.

## Security

- RLS is enabled on `digital_unit_allocations`.
- Table privileges are revoked from `PUBLIC`, `anon`, and `authenticated`.
- Table access is granted only to `service_role`.
- Trigger functions are not executable by customer/API roles or `service_role`.
- No Vault secret is created, read, or returned.
- No plaintext credential/code column exists.

## Local validation

- Migration static checks: PASS.
- Confirmed Phase 1 RPC names do not occur in the migration: PASS.
- Confirmed no Vault read/create operation occurs: PASS.
- `npm run build`: PASS.
- `npx tsc --noEmit`: reports only pre-existing errors in
  `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and
  `nutrition-erp/src/...`; no new error is attributable to this SQL migration.

## Live status

The migration has not been applied or verified against Supabase in this pass.
The local project has no installed Supabase CLI and no `supabase/config.toml`,
so no remote mutation was attempted and no live result is claimed.

Required live checks before the next slice:

- table, constraints, indexes, trigger, RLS, and grants;
- valid allocation with fake unit/order data only;
- product/variant mismatch rejection;
- duplicate unit and duplicate order-item/slot rejection;
- legal/illegal lifecycle transitions;
- customer-role read/write rejection;
- rollback behavior;
- preservation of Phase 1 behavior.

## Status

**PHASE 2 — 20260916 STATUS: PARTIAL**

Local implementation is complete, but live Supabase application and verification
remain pending. Do not start `20260917` yet.
