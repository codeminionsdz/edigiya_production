# Edigiya V2 — Phase 2 Implementation Plan

## Status and scope

The live Supabase Vault Security Gate is accepted as **PASSED** based on the
manual verification supplied for the production project:

- pgsodium 3.1.8 is enabled;
- `vault.secrets` and `vault.decrypted_secrets` exist;
- Vault objects/functions have no `PUBLIC`, `anon`, or `authenticated` grants;
- `vault` is not an exposed Data API schema;
- exposed application functions have no customer-role `EXECUTE` grants.

This document is planning only. It creates no migration, code, package,
environment, Vault secret, or Supabase change. Phase 1 remains untouched.

The plan covers Phase 2's digital inventory and unique fulfillment foundation,
while email and SlickPay remain future implementation phases.

## 1. Executive implementation target

After Phase 2, a product configured as a unique digital product will have
database-authoritative units. Each unit can be allocated to at most one order
item. The customer can receive the allocated content only after payment is
paid, fulfillment is delivered, and the account/guest ownership check passes.

The target lifecycle is:

`available → reserved → allocated → consumed/delivered`

and, when the reservation is released before consumption:

`reserved → released`

Administrative disabling is a separate terminal path:

`available → disabled` or `released → revoked`

No secret value participates in product catalog responses, payment events,
inventory movements, analytics, Telegram/Messenger messages, or generic order
lists.

## 2. Approved secret architecture

Use one Supabase Vault secret per unique credential/code payload, while ordinary
application tables store only opaque Vault references and non-secret metadata.

The current live privilege model must be preserved:

- no customer role can query `vault.secrets`;
- no customer role can query `vault.decrypted_secrets`;
- no customer role can execute a secret-retrieval function;
- `vault` remains outside the exposed Data API schemas;
- only a narrow server-side operation can retrieve one secret after all
  authorization checks.

The future retrieval operation should be a narrowly scoped PostgreSQL function
or equivalent server-only boundary. It must:

- use a fixed empty `search_path` and fully qualified names;
- be in a non-customer-facing schema if the server access mechanism supports
  that schema;
- otherwise remain in an exposed schema only with `EXECUTE` revoked from
  `PUBLIC`, `anon`, and `authenticated`, and granted only to the server role;
- return one authorized payload, never a collection or generic Vault view;
- avoid secret values in exceptions, logs, events, and audit metadata.

The existing `SUPABASE_SERVICE_ROLE_KEY` remains backend-only. It is not an
encryption key. A service-role compromise remains a high-impact incident, so
the decryption function and Vault grants must stay minimal and independently
audited.

## 3. Conceptual data model

Names below are the proposed names, not created objects.

### `digital_inventory_units`

Non-secret unit inventory metadata:

- `id` UUID primary key;
- `product_id` UUID not null;
- `variant_id` UUID nullable, with product consistency enforced;
- `unit_type` enum/check: `credential` or `code` for this phase;
- `vault_secret_id` UUID/reference, never raw content;
- `status`: `available`, `reserved`, `allocated`, `consumed`, `disabled`,
  `revoked`;
- `secret_version` or equivalent opaque version metadata;
- created/updated/disabled timestamps;
- non-sensitive admin audit fields.

### `digital_unit_allocations`

One allocation record per order-item/unit relationship:

- `unit_id`;
- `order_id`;
- `order_item_id`;
- the Phase 1 reservation ID where applicable;
- allocation status and timestamps;
- deterministic idempotency key;
- unique constraint on active unit allocation;
- unique constraint preventing duplicate allocation for the same order item
  and quantity slot.

### `digital_delivery_grants`

For guests, store only a hash of a random bearer grant:

- order/allocation relationship;
- grant hash;
- expiry and revocation timestamps;
- redemption/audit timestamps without secret content.

The raw grant is shown only once to the server-side email enqueue path in a
later phase; it is not stored in the database.

### Account library table

Use an explicit purchase/library record tied to a registered customer profile,
order, order item, and allocation. It is created idempotently only after the
order has a valid account relationship and fulfillment is delivered. Guest
orders remain valid without a library row.

## 4. Inventory source of truth and Phase 1 synchronization

This is the main design decision to approve before coding.

### Proposed decision

- For ordinary finite products (`file`, `link`, `manual`), existing Phase 1
  product/variant stock remains authoritative.
- For unique `credential`/`code` products, individual unit rows become the
  authoritative available quantity.
- `products.stock` or `product_variants.stock` becomes a maintained projection
  for catalog display and compatibility, not a second independent authority.

For unique products, the same database transaction must lock units, create the
Phase 1 reservation, create unit allocations, and update the stock projection.
Checkout must not decide availability from the projection alone.

This creates no competing source for one product: each product type has one
authority, and the projection is reconciled transactionally. Admin unit add,
disable, allocation, release, and consumption operations must update the
projection in the same transaction or reject the operation.

If the team does not approve this per-product authority model, coding must stop
and the alternative—Phase 1 stock remaining authoritative while units are
strictly reconciled—must be specified first.

## 5. Unique allocation transaction

The future database-authoritative RPC will receive only order/order-item
context and an idempotency key from the trusted server path. It must not accept
client-supplied price, Vault secret, or arbitrary ownership identifiers as
authorization.

Within one transaction it will:

1. Lock the target order, order item, and Phase 1 reservation.
2. Verify digital order, paid/eligible state for delivery allocation, product,
   variant, fulfillment type, and requested quantity.
3. For each required unit, select one matching `available` unit using a stable
   order and `FOR UPDATE SKIP LOCKED` or an equivalent lock-safe strategy.
4. Move the unit and create exactly one allocation row.
5. Update the unique-product stock projection.
6. Write non-secret inventory/allocation audit metadata.
7. Return opaque allocation IDs and status only.

The allocation is idempotent by order item plus operation key. A retry returns
the existing allocation and never selects another unit. A concurrent request
cannot claim the same locked unit. If any unit is unavailable, the whole
transaction rolls back without a partial allocation.

## 6. Lifecycle integration

The Phase 1 checkout reservation remains the first quantity reservation. The
unique-unit allocation must be attached to that reservation/order item rather
than introducing a separate stock decrement.

- Checkout/reservation: reserve product quantity and, for unique products,
  reserve matching units in the same transaction.
- Payment rejection/expiry: call the existing Phase 1 release path and release
  unit allocations exactly once.
- Payment acceptance: call the existing Phase 1 consume path and consume unit
  allocations exactly once.
- Fulfillment preparation/delivery: require the consumed/paid allocation and
  attach the allocated unit to the delivered fulfillment item without copying
  raw secret values into ordinary fulfillment rows.
- Retry: return existing state; do not create a second movement, allocation,
  fulfillment item, library row, or grant.

Any replacement of `create_order_payment_atomic` or payment transition logic
must be a forward migration preserving all Phase 1 guarantees and must be
reviewed as a Phase 1 regression-sensitive change.

## 7. Fulfillment types

Phase 2 backend contracts should support these distinct paths:

- `credential`: Vault-backed unique unit, one allocation per unit;
- `code`: Vault-backed unique unit, one allocation per code;
- `file`: existing private Storage content, with later type validation;
- `link`: server-authorized delivery link, not a public catalog URL;
- `manual`: existing Admin-entered content, kept separate from unique-secret
  allocation.

No raw credential/code is copied to `fulfillment_items.code`. Existing manual
  plaintext code behavior is legacy compatibility and must not be used for the
  new unique-unit path without a separately approved migration/redaction plan.

## 8. Guest delivery grants

Guest delivery requires a cryptographically random bearer token generated by
the server. Store only a one-way hash, bind it to one order/allocation, set a
short expiry, support revocation, and rate-limit redemption.

The delivery endpoint must independently verify:

- grant validity and expiry;
- digital order and matching order item/allocation;
- paid payment;
- delivered/eligible fulfillment;
- no revoked or disabled unit;
- requested allocation belongs to the order.

An order UUID, order number, session ID, or client-supplied unit ID alone is
never sufficient.

## 9. Account library

Account ownership must be explicit. After a verified account customer owns the
order and delivery is complete, insert one idempotent library row per order
item/allocation. Do not infer ownership from an email string alone and do not
automatically merge unrelated guest sessions.

If a guest later registers, linking old orders requires a separately approved,
verified ownership flow. It is not implicit in this Phase 2 allocation RPC.

## 10. Secure customer delivery

The preferred future email contains an Edigiya delivery link, not raw
credentials. The customer-facing server response may reveal only the specific
authorized unit after the full authorization chain. It must not return Vault
IDs, object paths, internal allocation IDs, or other customers' records.

For account customers, use authenticated account-to-order ownership plus paid
and delivered checks. For guests, use the hashed delivery grant. Both paths
must use the same allocation and Vault retrieval boundary.

Email delivery itself is not implemented in Phase 2. Phase 2 only prepares the
authoritative allocation/delivery state that a later email outbox can consume.

## 11. Email notification architecture (future plan only)

Later email implementation should use an idempotent outbox/event model:

- enqueue after successful fulfillment delivery;
- target both guests and account customers;
- store recipient, event type, attempt state, and provider message ID;
- never store raw secrets in the outbox;
- use a secure delivery URL or one-time delivery token;
- retry without creating a second fulfillment or allocation;
- record failure separately so email failure does not roll back paid,
  consumed, delivered inventory.

No email provider or sending code is part of this plan's implementation step.

## 12. RLS and server-only boundaries

New unit, allocation, grant, and library tables should have RLS enabled and no
customer direct write path. Default grants must be revoked explicitly from
`PUBLIC`, `anon`, and `authenticated`; server actions call only narrowly
authorized RPC/repository functions.

Vault remains outside Data API exposed schemas. Never grant customer roles
access to the decrypted view. Every `SECURITY DEFINER` function must use a
fixed search path, schema-qualified references, strict input validation, and
minimal `EXECUTE` grants.

Admin operations must use the existing server-side Admin session check before
calling inventory functions. Customer operations must derive ownership from
the server session/grant and database relationships.

## 13. Migration order

No migrations are created by this planning pass. The proposed forward sequence
after `20260914` is:

1. `20260915_digital_inventory_units_foundation.sql` — metadata tables,
   constraints, indexes, RLS, non-secret Vault reference only.
2. `20260916_digital_unit_allocation_atomic.sql` — allocation/release/consume
   functions and idempotency constraints, integrated with Phase 1.
3. `20260917_digital_delivery_grants_library.sql` — guest grant and account
   library schema plus ownership-safe functions.
4. `20260918_digital_delivery_boundary.sql` — only after the decryption and
   customer delivery contract is reviewed; narrow secret retrieval boundary.

The exact filenames may change after schema review. Historical migrations
`20260908` through `20260914` must not be rewritten.

## 14. Rollback and compatibility strategy

- Every migration is forward-only and transaction-safe where PostgreSQL allows.
- Existing orders, payments, reservations, movements, fulfillment rows, and
  plaintext legacy manual codes are preserved.
- New columns/tables are additive before any checkout branch is enabled.
- Feature activation is gated by product configuration and can be disabled for
  new unique products without deleting allocated records.
- Failed allocation rolls back unit status, allocation, projection, and audit
  rows together.
- A deployment rollback means disabling the new path or reverting application
  code to the prior compatible path; it does not delete historical allocations
  or Vault secrets.
- Data migrations must be tested on an isolated QA project and have a restore
  plan before production application.

## 15. Test and live verification plan

Before a READY status, run isolated live tests using fake secrets and disposable
products/orders:

1. Create credential and code units through the Admin server path.
2. Confirm no raw secret appears in product APIs, order lists, events, logs,
   or allocation metadata.
3. Allocate one unit successfully.
4. Race two customers for the final unit; expect one success.
5. Race two requests for the same order item/key; expect one allocation.
6. Retry allocation; expect the same allocation, no duplicate rows.
7. Force a later transaction failure; expect no partial allocation or stock
   projection change.
8. Reject/expire payment; expect exactly one release and reusable unit.
9. Accept payment; expect exactly one consumption and no reallocation.
10. Disable a unit; confirm it cannot be allocated.
11. Verify variant A allocation does not consume variant B.
12. Verify unlimited generic inventory does not create finite unit behavior.
13. Verify guest grant ownership, expiry, revocation, and replay behavior.
14. Verify account library ownership and no cross-account access.
15. Verify anon/authenticated cannot read or mutate unit/allocation/grant tables.
16. Verify Admin authorization on every mutation.
17. Re-run all Phase 1 finite, variant, unlimited, idempotency, concurrency,
    rollback, payment, and RLS tests.
18. Clean all QA records and confirm pre-test production counts/data are
    unchanged.

## 16. Remaining decisions requiring approval before coding

The Vault gate is passed, but these product/security decisions still require
explicit approval:

1. **Inventory authority:** approve the proposed per-product model where unique
   units are authoritative and Phase 1 stock is a transactional projection for
   unique products, while ordinary finite stock remains Phase 1-authoritative.
2. **Delivery exposure:** approve secure Edigiya delivery links as the default,
   rather than sending raw credentials in email.
3. **Server boundary:** approve the existing backend `service_role` as the only
   caller of the narrow Vault retrieval function, with no customer-role
   execution; or provision a separate database role/direct connection if
   stronger isolation is required.
4. **Legacy plaintext codes:** decide whether existing `fulfillment_items.code`
   records remain legacy-only or receive a separately scoped migration. They
   must not be silently copied into Vault.
5. **Vault maturity:** accept Supabase Vault's current Public Alpha status for
   production, with restore testing and an incident-recovery owner.
6. **Guest-to-account linking:** keep it explicit and separate, or approve a
   future verified linking flow. It must not be inferred from email equality.

Until these decisions are approved, implementation must not begin.

## 17. Approved architecture decisions

The following decisions are now approved for implementation:

1. Unique digital units are authoritative for unique credential/code products.
   Phase 1 product/variant stock remains a transactional projection for those
   products and is never used as a competing availability source.
2. Secure Edigiya delivery links are the default delivery mechanism. Raw
   credentials/codes must never be sent by email.
3. The existing backend `service_role` is the only caller of the narrow Vault
   retrieval boundary. `anon`, `authenticated`, and customer roles receive no
   execution or Vault access.
4. Existing plaintext `fulfillment_items.code` rows remain legacy-only. No
   automatic migration or copying into Vault is allowed.
5. Supabase Vault is approved for production conditionally. Before production
   credentials are loaded, QA must verify restore/recovery and an explicit
   recovery owner and incident process must be documented.
6. Guest-to-account linking is deferred. Phase 2 must not infer ownership from
   email equality or merge guest orders into accounts.

## 18. Secret versioning and replacement policy

Every unique unit has one authoritative current secret version. The unit points
to the current Vault secret reference; raw secret values never appear in the
unit table, allocation table, events, logs, emails, or generic APIs.

Replacement rules:

- A replacement creates a new Vault secret and a new version record before the
  current pointer changes.
- The pointer switch is atomic and auditable.
- A unit with an active or consumed allocation keeps its allocation ownership;
  replacement must not reassign the unit or create a second allocation.
- A secret version already delivered to a customer is never silently replaced
  in that historical delivery record. The business policy must explicitly
  choose whether replacement affects future access only or requires a new
  authorized delivery; the default is future access only, with the delivered
  version retained as an opaque audit reference.
- The previous version is marked `retired` or `revoked` only after the new
  version is valid and the pointer update succeeds.
- Repeating the same replacement request with the same idempotency key returns
  the existing replacement result and does not create another version or Vault
  secret.
- A failed replacement rolls back the pointer and application metadata. An
  orphan Vault secret must not become customer-visible; cleanup is a separate
  audited operation if Vault creation cannot participate in the same database
  transaction.
- Version IDs and Vault IDs are internal opaque identifiers and are never
  exposed to customers.

The implementation must define whether replacement is allowed for `available`,
`reserved`, `allocated`, and `consumed` units. The safe default is to allow
replacement only before allocation, and require an explicit Admin recovery
operation for already allocated/consumed units.

## 19. Exact implementation sequence

No implementation is performed by this planning update. The approved sequence
for the coding phase is:

1. **Baseline and guardrails** — capture schema/row-count baselines in QA,
   verify Vault grants again, document the recovery owner/process, and add
   redaction rules before any secret-bearing operation exists.
2. **Unit metadata foundation** — create the forward unit/version metadata
   schema after `20260914`, with constraints, indexes, RLS, and no plaintext
   secret columns.
3. **Vault write boundary** — implement an Admin-only server operation that
   creates a Vault secret without placing its value in migrations, logs, events,
   or ordinary database rows; record only the opaque Vault reference and
   version metadata.
4. **Atomic allocation** — implement the database-authoritative allocation
   RPC integrated with the Phase 1 reservation/order item, with row locks,
   unique constraints, deterministic idempotency, and projection updates.
5. **Release/consume transitions** — connect rejection/expiry and successful
   payment to exactly-once unit release/consumption while preserving Phase 1
   movement semantics.
6. **Replacement operation** — implement version creation, validation, atomic
   current-version switching, ownership preservation, idempotent retries, and
   audited retirement/revocation.
7. **Fulfillment binding** — attach opaque allocated-unit references to
   fulfillment without copying secrets into `fulfillment_items.code` or
   generic fulfillment content.
8. **Customer delivery boundary** — implement account ownership delivery and
   short-lived guest grants only for the specific order/allocation; retrieve
   the current authorized Vault secret through the single server-only path.
9. **Account library** — add explicit account purchase/library records only for
   registered ownership; do not implement guest-to-account linking.
10. **Future email contract** — define the outbox event contract only; email
    sending remains a later phase and receives secure links, never raw secrets.
11. **Admin contract/UI later** — validate backend operations first; add only
    the minimal Admin controls required to manage units and versions after the
    security contract passes.
12. **Live verification and cleanup** — run isolated QA tests, recovery tests,
    concurrency/idempotency tests, redaction tests, Phase 1 regression tests,
    and clean all QA data before any production credential is loaded.

## 20. Final schema/function boundary

### Tables

- `digital_inventory_units`: product/variant, unit type, non-secret lifecycle
  status, current version reference, and audit timestamps.
- `digital_unit_secret_versions`: unit ID, opaque Vault secret ID, version
  number, status, replacement idempotency key, and non-secret audit metadata.
- `digital_unit_allocations`: unit/order/order-item/reservation relationship,
  lifecycle, and idempotency key; no secret value.
- `digital_delivery_grants`: hashed guest grant, specific allocation/order
  binding, expiry, revocation, and redemption metadata.
- account library/purchase table: explicit customer-profile/order-item/
  allocation ownership; no guest linking in this phase.

### Functions and server operations

- Admin-only create-unit/create-secret operation.
- Admin-only replace-secret-version operation.
- Atomic allocate-units operation.
- Atomic release-units and consume-units operations integrated with existing
  payment/reservation transitions.
- Authorized customer delivery operation that verifies paid + delivered,
  account/grant ownership, allocation ownership, and current version before
  retrieving one Vault value.

All functions that require elevated privileges must use fixed search paths,
fully qualified names, strict validation, minimal grants, and server-only
execution. Customer roles must not call Vault functions or decrypted views.

## 21. Remaining risks

- Vault is still a Public Alpha feature and requires the approved QA restore
  test and a named recovery owner before production secrets are loaded.
- A compromised `service_role` remains high impact because it is the approved
  server caller of the decryption boundary.
- Existing plaintext legacy `fulfillment_items.code` data remains a separate
  historical risk and must not be mixed with the new unit system.
- Delivery-link replay, expiry, revocation, and rate limiting require tests.
- Secret replacement after allocation needs an explicit operational policy;
  the default safe behavior is to disallow automatic replacement of allocated
  or consumed units.
- Vault creation and Postgres metadata are not one transaction; orphan-secret
  cleanup and failure handling must be designed and audited.
- No production credential may be loaded until the full live verification
  suite passes.

## Final implementation gate

Architecture approval is complete. The implementation prerequisites are now
defined, but no code or database work has started.

**READY TO IMPLEMENT**

Implementation may begin only within this approved sequence and only after the
first QA Vault restore/recovery test and recovery-owner process are recorded.

**PHASE 2 IMPLEMENTATION: NOT STARTED**
