# Edigiya V2 — Phase 1 Final Verification

Date: 2026-09-04

Scope: Inventory + atomic stock safety + digital inventory foundation only.

No Phase 2 work was started. No email, fulfillment, SlickPay, RLS hardening of existing commerce tables, or UI redesign was performed.

## 1. Migration audit

Inspected completely:

- `supabase/migrations/20260912_inventory_foundation.sql`
- `supabase/migrations/20260913_inventory_reserved_movement_alignment.sql`
- `supabase/migrations/20240213_initial_schema.sql`
- `supabase/migrations/20260901_add_payment_core.sql`
- `supabase/migrations/20260905_allow_digital_checkout.sql`
- `supabase/migrations/20260906_admin_payment_operations.sql`
- `supabase/migrations/20260908_digital_fulfillment_foundation.sql`
- `supabase/migrations/20260909_harden_digital_fulfillment.sql`
- `supabase/migrations/20260910_digital_fulfillment_content.sql`
- `supabase/migrations/20260911_require_delivery_content.sql`

Static findings:

- No duplicate inventory tables or columns were found in the migration set.
- `products.inventory_type` and `products.fulfillment_type` are new columns with compatible defaults for existing rows.
- Existing `products.stock` and `product_variants.stock` remain integer stock fields; non-negative checks are additive.
- Foreign keys point to the existing `orders`, `products`, and `product_variants` tables.
- No enum or PostgreSQL type conflict was introduced; statuses and types are constrained text values.
- No new trigger conflicts were introduced.
- RPC signatures intentionally replace the existing same-signature checkout and Admin payment functions with `CREATE OR REPLACE FUNCTION`.
- New inventory tables are isolated with RLS enabled and direct access revoked from `PUBLIC`, `anon`, and `authenticated`.
- Security-definer functions use `SET search_path = public, pg_temp`.
- Existing orders without an inventory reservation remain compatible; payment consumption is a no-op for those orders.
- The migration does not destructively alter legacy physical-order columns.

Correctness correction made during this review:

- The local migration now records a `reserved` inventory movement for every reservation item. This is required for a complete audit trail.
- The remote database was already applied before this correction and therefore does not yet contain this latest local behavior. This local/remote drift is the remaining blocker.

## 2. Database application status

Read-only Supabase REST probes returned HTTP 200 for:

- `inventory_reservations`
- `inventory_reservation_items`
- `inventory_movements`
- `products.inventory_type` and `products.fulfillment_type`

Conclusion: the Phase 1 schema/RPC has been applied to the linked Supabase project, but the remote function behavior does not match the latest local migration file: live reservation tests showed no `reserved` movement. The migration file must not be blindly re-run because its tables/functions already exist.

No migration was applied by this verification pass.

## Phase 1 Drift Repair

### Root cause

The live database was applied from the earlier 20260912 behavior. That version decremented stock and created reservation items, but did not insert a `reserved` row into `inventory_movements`. The current local 20260912 file was later corrected to insert it, creating local/remote drift. The migration chain contains no inventory reservation trigger that could have supplied the missing event automatically.

This was confirmed by the actual local SQL history and live reservation/rejection tests: the remote recorded `released` but no `reserved` movement.

### Forward migration created

`supabase/migrations/20260913_inventory_reserved_movement_alignment.sql`

The repair is additive:

1. Backfills only missing `reserved` movements for existing reservation items.
2. Uses the deterministic idempotency key `reservation:<reservation_id>:item:<item_id>:reserved`.
3. Adds an `AFTER INSERT` trigger for future reservation items.
4. Does not delete or rewrite existing movement history.
5. Does not alter stock arithmetic, payment transitions, reservation states, variants, unlimited logic, or rollback behavior.

The trigger uses `ON CONFLICT DO NOTHING`, so it is compatible with the explicit reserved insert in the corrected local 20260912 RPC and cannot create duplicate reserved movements.

### Remote application status

The 20260913 migration has **not** been applied remotely. The available connected mechanism can read Supabase REST resources, but cannot execute arbitrary SQL safely. Apply it manually in Supabase SQL Editor after confirming the project and reviewing the complete file.

### Before / after lifecycle

Before repair: `stock decrement → released/consumed`

After repair: `stock reservation → reserved movement → consumed movement` or `stock reservation → reserved movement → released movement`.

The original live tests passed for stock safety, idempotency, concurrency, rejection/release, acceptance/consumption, variants, unlimited inventory, rollback, and RLS. The corrected reserved lifecycle is not yet live-verified.

## 3. Actual database verification

All tests used isolated products named with a `qa-` prefix, fake customer data, random sessions, and random idempotency keys. Test orders and products were removed after each run. No real customer or production order was used.

| Scenario | Result | Observation |
|---|---|---|
| Finite stock = 1, two different concurrent checkouts | PASS | Exactly one succeeded; final stock was 0. |
| Quantity 2 while stock = 1 | PASS | RPC failed; stock remained 1; no order was created. |
| Same idempotency key repeated | PASS | Same order/payment returned; one order; stock changed once. |
| Same idempotency key concurrently | PASS | Both calls returned one authoritative order; one distinct order; stock changed once. |
| Reject payment | PASS with audit warning | Stock returned to 1 and release movement was recorded. Remote result lacked the newly added `reserved` movement. |
| Accept payment | PASS | Stock remained 0; one consumed movement. A second verify was rejected. |
| Variant A = 1, Variant B = 5 | PASS | A became 0; B remained 5. |
| Unlimited product with stock = 0 | PASS | Checkout succeeded and product remained available. |
| Rollback after inventory operation | PASS | Forced duplicate-line failure returned HTTP 400; stock remained 1; no order or movement remained. |

## 4. Concurrency result

The live finite-stock race passed: one of two concurrent quantity-one requests succeeded and the other failed. The final stock never became negative.

The live same-key race also passed: two simultaneous requests produced one order/payment result and one stock deduction.

The implementation uses deterministic row locking with `FOR UPDATE`, conditional stock updates, and database transaction rollback.

## 5. Idempotency result

PASS on the applied remote behavior:

- repeated same-key calls returned the same order and payment;
- concurrent same-key calls returned one distinct order;
- no second stock deduction occurred;
- payment transition retry was rejected by the payment state guard.

## 6. Reservation lifecycle result

PARTIAL:

- reservation creation and stock deduction passed;
- rejection released stock;
- acceptance consumed the reservation exactly once;
- expired/released/consumed state guards are present;
- the local migration records `reserved`, `released`, and `consumed` movements;
- the already-applied remote behavior recorded `released` and `consumed`, but the live remote reservation did not contain the newly required `reserved` movement.

## 7. Variant inventory result

PASS. Variant stock is locked and decremented independently from the parent product stock. The live test confirmed that purchasing Variant A did not change Variant B.

## 8. Unlimited inventory result

PASS. The checkout RPC skips numeric stock rejection and stock deduction for products whose `inventory_type = 'unlimited'`. Storefront mappings also treat unlimited products as available.

## 9. RLS result

PASS for the tested client boundary:

- anonymous read of `inventory_reservations` returned HTTP 401;
- anonymous insert into `inventory_movements` returned HTTP 401;
- anonymous direct product stock patch returned HTTP 200 with no changed row; stock remained unchanged;
- service-role/database-authoritative RPC paths performed the inventory mutations.

This does not claim that existing legacy product policies are globally hardened; that is outside Phase 1 scope.

## 10. Rollback result

PASS. A forced failure after the first attempted stock decrement rolled back the transaction. The test confirmed:

- stock restored to its original value;
- zero order rows for the failed idempotency key;
- zero inventory movements for the failed transaction.

## 11. Failures and remaining risks

### BLOCKER

The 20260913 forward repair is not yet applied. Until it is applied and re-tested, the remote database still lacks the complete intended `reserved → consumed/released` audit lifecycle.

### Warnings

- `psql` is unavailable locally, so SQL parsing was not performed with PostgreSQL itself.
- Live tests used the Supabase REST API and isolated test records; no production destructive test was performed.
- Unique credential allocation per unit is not implemented; it belongs to a later inventory/fulfillment phase.
- Reservation expiration is implemented as a callable database function; scheduling/cron invocation is not part of this phase.
- Existing legacy checkout helpers outside the hardened digital RPC remain outside this Phase 1 scope.

## 12. Exact files and migrations involved

### Phase 1 implementation files

- `supabase/migrations/20260912_inventory_foundation.sql`
- `lib/repositories.ts`
- `app/(store)/checkout/actions.ts`
- `app/admin/actions.ts`
- `app/admin/products/product-editor.tsx`
- `app/(store)/product/[slug]/page.tsx`
- `app/(store)/product/[slug]/client.tsx`
- `components/store/home-sections.tsx`

### Comparison migrations

- `supabase/migrations/20240213_initial_schema.sql`
- `supabase/migrations/20260901_add_payment_core.sql`
- `supabase/migrations/20260902_manual_payment_settings.sql`
- `supabase/migrations/20260903_payment_blocker_fixes.sql`
- `supabase/migrations/20260904_harden_atomic_checkout_rpc.sql`
- `supabase/migrations/20260905_allow_digital_checkout.sql`
- `supabase/migrations/20260906_admin_payment_operations.sql`
- `supabase/migrations/20260907_atomic_payment_proof_submission.sql`
- `supabase/migrations/20260908_digital_fulfillment_foundation.sql`
- `supabase/migrations/20260909_harden_digital_fulfillment.sql`
- `supabase/migrations/20260910_digital_fulfillment_content.sql`
- `supabase/migrations/20260911_require_delivery_content.sql`

## 13. Controlled Supabase SQL Editor procedure

Because the remote schema is already present, do not paste and execute 20260912 again. Apply the new 20260913 forward migration only. Before execution:

1. Confirm the project URL is the Edigiya Supabase project.
2. Open SQL Editor and use a new query.
3. Review the complete `20260913_inventory_reserved_movement_alignment.sql` file.
4. Execute it once in a Supabase SQL Editor query.
5. Re-run the isolated finite/rejection tests above.
6. Verify each reservation has a `reserved` movement, and that rejected reservations have a matching `released` movement.
7. Do not use real customer data or production orders for the test.

The migration file is the executable corrective patch. It was created locally but intentionally not executed remotely in this pass.

## Final recommendation

The core stock-safety behavior is working in the live database, but the remote database still lacks the required reservation audit event. Apply 20260913 manually, then repeat live verification before considering Phase 1 complete.

PHASE 1 STATUS: PARTIAL

## Final live Drift Repair verification — 20260913

20260913 was confirmed present on the linked Supabase database by live behavior. The new trigger executed during a test reservation. However, the first new reservation failed with:

`duplicate key value violates unique constraint inventory_movements_idempotency_key_key`

The exact sequence is:

1. The 20260913 `AFTER INSERT` trigger inserts the `reserved` movement.
2. The already-deployed remote `create_order_payment_atomic` also inserts the same `reserved` movement.
3. The RPC insert does not use `ON CONFLICT DO NOTHING`.
4. The unique idempotency key correctly rejects the duplicate, but the whole checkout transaction rolls back.

This is a real compatibility blocker between the applied trigger and the deployed RPC. It preserves data safety but prevents successful checkout after the drift repair.

Because the first reservation could not complete, the post-20260913 live checks for acceptance, rejection, idempotent retry, concurrent checkout, variant, unlimited, and full lifecycle were not re-run as passing. Their pre-20260913 results remain documented above, but they cannot be treated as final post-repair verification.

The forced rollback behavior remains safe: the failed test transaction did not leave an order or committed movement. Test records were cleaned using only the isolated `qa-final-*` targets. No real customer/order data was modified.

### Final verification outcome

- Reserved movement after repair: BLOCKED by duplicate insert compatibility failure.
- Accepted lifecycle: NOT VERIFIED after repair.
- Rejected/expired lifecycle: NOT VERIFIED after repair.
- Idempotent retry: NOT VERIFIED after repair.
- Concurrent final-unit checkout: NOT VERIFIED after repair.
- Variant/unlimited: NOT VERIFIED after repair.
- Rollback: PASS for the failed transaction; no phantom committed records.
- RLS: Existing direct-client boundary remains as previously verified, but full post-repair verification is incomplete.
- Existing data: no corruption observed; QA records were cleaned.

No further schema or code changes were made in this final verification pass. A follow-up corrective migration is required to make the trigger and deployed RPC compatible, for example by making the deployed reserved insert conflict-safe or using a deferred trigger. Do not proceed to Phase 2 before that repair and a complete live re-test.

PHASE 1 STATUS: BLOCKED

## Phase 1 Blocker Repair

### Exact root cause

The live database had two writers for the same logical `reserved` movement:

1. `create_order_payment_atomic` in `20260912_inventory_foundation.sql` inserts the movement after creating each `inventory_reservation_items` row.
2. `20260913_inventory_reserved_movement_alignment.sql` added `record_inventory_reservation_movement()` as an `AFTER INSERT` trigger on `inventory_reservation_items`.

The trigger inserted the movement first. The RPC then inserted the same deterministic idempotency key without conflict handling. The unique constraint correctly raised a duplicate-key error and rolled back the whole checkout.

### Chosen single source of truth

The atomic checkout RPC is the authoritative writer for `reserved` movements because it owns, in one transaction:

- the order;
- the reservation;
- the stock decrement;
- the reservation item;
- the reserved movement;
- the payment and payment-created event.

The existing `release_inventory_reservation` function remains the single writer for `released`, and `consume_inventory_reservation` remains the single writer for `consumed`. Their idempotent state guards and movement keys remain unchanged.

### Correction created

`supabase/migrations/20260914_inventory_movement_writer_fix.sql`

This forward migration removes only the duplicate trigger and its helper function. It does not use `ON CONFLICT` as a band-aid, does not delete existing movements, and does not change stock, payment, reservation, variant, unlimited, rollback, or RLS logic.

### Deployment status

20260914 was subsequently applied manually to Supabase. The live verification below confirms the repaired behavior.

### Post-correction lifecycle

After deployment, the intended single-writer lifecycle is:

`create_order_payment_atomic: reserve stock → create reservation item → insert exactly one reserved movement`

then either:

`payment accepted → consume_inventory_reservation → exactly one consumed movement`

or:

`payment rejected/expired → release_inventory_reservation → exactly one released movement`.

The post-correction live verification is recorded below.

### Remaining limitation

Phase 1 was blocked before 20260914 and became ready only after the live verification below passed.

## Final live verification after 20260914

20260914 was confirmed applied by successful live behavior. Tests used isolated `qa-final3-*` products, random sessions and checkout keys, and fake customer data only. All QA orders, movements, variants, and products were cleaned after the run.

| Check | Live result |
|---|---|
| New finite reservation | PASS — checkout succeeded with exactly one `reserved` movement and delta `-1`; stock became 0. |
| Payment acceptance | PASS — lifecycle was exactly `reserved → consumed`; one movement of each type. A second acceptance was rejected. |
| Payment rejection | PASS — lifecycle was exactly `reserved → released`; one movement of each type and stock returned to 1. A second rejection was rejected. |
| Expired reservation | PASS — exactly one `released` movement and stock returned to 1. |
| Same checkout key retry | PASS — same order/payment returned, one `reserved` movement, no duplicate key, stock changed once. |
| Concurrent final unit | PASS — exactly one of two concurrent buyers succeeded; stock ended at 0 and one `reserved` movement existed. |
| Quantity greater than stock | PASS — checkout failed; stock stayed 1; no order or movement was created. |
| Variant inventory | PASS — Variant A changed 1 → 0; Variant B stayed 5; movement referenced only Variant A. |
| Unlimited inventory | PASS — checkout succeeded with stock 0; stock stayed 0; reservation delta was 0 with `stock_reserved = false`. |
| Transaction rollback | PASS — forced duplicate-line failure left stock at 1, zero order rows, and zero movements. |
| Inventory RLS | PASS — anonymous inventory read and insert returned 401; anonymous product stock patch changed no row. |
| Existing data integrity | PASS — before/after counts were unchanged: products 1, orders 15, payments 15, inventory movements 0. |

For every successful test order, movement idempotency keys were unique. No duplicate `reserved`, `released`, or `consumed` movement occurred. The final live lifecycle is:

`create_order_payment_atomic → reserved → consumed`

or:

`create_order_payment_atomic → reserved → released`

No schema or code changes were made during this verification pass. No Phase 2 work was started.

PHASE 1 STATUS: READY
