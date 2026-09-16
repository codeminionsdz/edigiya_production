# Edigiya V2 — Implementation Readiness

**Audit scope:** read-only analysis of the current project against `EDIGIYA_V2_COMMERCE_ARCHITECTURE.md`.

**Audited project:** `C:\Users\codem\OneDrive\project\egygiya`

**Audit date:** 2026-09-04

**Changes made to application code, database, packages, or environment:** None.

## 1. Executive Summary

The current application already contains a substantial digital-commerce foundation: product browsing, session carts, digital checkout, authoritative price checks in the checkout RPC, manual payment methods, payment proof submission, Admin payment verification/rejection, private payment-proof storage, and a first digital-fulfillment workflow.

It is not yet implementation-ready for the full V2 architecture.

The most important gap is inventory. The current system checks `products.stock` and `product_variants.stock`, but no successful checkout or payment path decrements either value. There is no row-locking inventory operation, no inventory ledger, no reservation model, and no unique-unit table. Two concurrent purchases can therefore both pass the check for the last unit, and the same credential/code cannot currently be assigned atomically because such units are not modeled.

The second major gap is delivery. Admin can create manual fulfillment content and mark an order delivered, and an account customer can read delivered content. However, there is no email provider/send queue, no guest secure-delivery token/page, no account-library table, no inventory-unit assignment, and no email retry state. The current `/api/send-order-notification` route is a Telegram notification route, not an email-delivery implementation.

There are also security issues in legacy/session code that must be resolved before treating the system as a production V2 commerce core: several server actions accept caller-supplied session IDs, legacy RLS policies use `USING (true)`, and customer-auth signing has a hardcoded fallback secret.

**IMPLEMENTATION READINESS: NOT READY**

The project should proceed phase-by-phase only after the inventory, delivery/email, identity-linking, and security boundaries below are designed and reviewed.

## 2. Current Architecture

The current stack is Next.js 16.1.6 with App Router, React client components, server actions, Supabase/Postgres, Supabase Storage, and a service-role repository layer.

Observed layers:

- Store UI: `app/(store)/**`, `components/store/**`.
- Server actions: `app/(store)/actions.ts`, `app/(store)/checkout/actions.ts`, `app/admin/actions.ts`.
- Repository/data access: `lib/repositories.ts`.
- Payment service: `lib/payments/service.ts`, `lib/payments/types.ts`.
- Customer auth/session signing: `app/(store)/auth-actions.ts`, `middleware.ts`.
- Admin auth: `lib/admin-auth.ts`, `app/admin/middleware.tsx`.
- Database changes: `supabase/migrations/*.sql`.
- External notification currently present: `app/api/send-order-notification/route.ts` sends Telegram messages.

The normal current checkout path is:

`app/(store)/checkout/page.tsx` → `placeOrder` → `getCheckoutProductsByIds` → `createOrderPaymentAtomic` → database RPC `create_order_payment_atomic`.

The database RPC is invoked through a service-role client. The customer UI does not directly write Supabase tables.

## 3. Current Database

### Existing base tables

`20240213_initial_schema.sql` creates:

- Catalog: `departments`, `categories`, `brands`, `products`, `product_images`, `product_specs`, `product_variants`.
- Commerce: `carts`, `cart_items`, `addresses`, `orders`, `order_items`.
- Physical shipping: `shipping_wilayas`, `shipping_rates`, `shipping_rules`.
- Content: `homepage_banners`, `marquee_brands`.

Important current columns:

- `products.stock INTEGER NOT NULL DEFAULT 0`.
- `product_variants.stock INTEGER NOT NULL DEFAULT 0`.
- `orders.session_id`, `orders.status`, `orders.subtotal_dzd`, `orders.shipping_dzd`, `orders.total_dzd`, `orders.wilaya_code`, `orders.delivery_method`, `orders.address_snapshot`.
- `order_items` stores price and quantity snapshots.

### Later tables and changes

- `customer_profiles`: `20260214_add_customer_profiles.sql`, with password fields added by `20260215_add_customer_auth_fields.sql`.
- Store settings/payment instructions: `20260408_add_store_settings.sql`, `20260902_add_manual_payment_settings.sql`.
- Payments/events/storage bucket: `20260901_add_payment_core.sql`.
- Checkout idempotency and RPC revisions: `20260903_payment_blocker_fixes.sql`, `20260904_harden_atomic_checkout_rpc.sql`, `20260905_allow_digital_checkout.sql`.
- Admin payment transition RPC: `20260906_admin_payment_operations.sql`.
- Atomic payment proof transition: `20260907_atomic_payment_proof_submission.sql`.
- Fulfillment foundation/events: `20260908_digital_fulfillment_foundation.sql`.
- Digital fulfillment hardening: `20260909_harden_digital_fulfillment.sql`.
- Fulfillment content and private bucket: `20260910_digital_fulfillment_content.sql`.
- Content-required delivery rules: `20260911_require_delivery_content.sql`.

### V2 tables currently absent

No current migration creates tables for:

- inventory transactions/ledger;
- stock reservations or reservation expiry;
- unique credentials/codes/units;
- account purchase/library records;
- guest secure-delivery tokens;
- email outbox/queue, delivery attempts, or email status;
- general cross-domain audit events (`ORDER_CREATED`, `INVENTORY_DECREMENTED`, `EMAIL_SENT`, etc.).

## 4. Product Audit

### What we already have

- Product identity, localized titles/descriptions, category/department/brand relations.
- Price and compare-at price in `products`.
- Images/specifications.
- Basic product variants with `price_delta_dzd`.
- Active/inactive state.
- Admin product creation/editing in `app/admin/products/product-editor.tsx` and `app/admin/products/actions.ts`.

### Correct

- Public product reads are separated from server-side writes.
- Checkout re-reads product price and active status from the database.
- Product and variant IDs are validated by the checkout action and again by `create_order_payment_atomic`.
- Order items keep title, unit price, quantity, and line-total snapshots.

### Missing or wrong for V2

- No `fulfillment_type` on the product (`file`, `link`, `code`, `credentials`, `manual`).
- No `inventory_type` (`unlimited`/`finite`).
- No explicit product-level rule saying whether a variant is required.
- No relation between a product's fulfillment type and its delivery content.
- No product-level capability for unique-unit inventory.

## 5. Inventory Audit

### Current implementation

`products.stock` and `product_variants.stock` exist. `placeOrder` in `app/(store)/checkout/actions.ts` checks stock before calling the RPC. The final local version of `create_order_payment_atomic` in `20260905_allow_digital_checkout.sql` also checks product/variant stock.

### Correct

- The client cannot choose the authoritative unit price.
- Variant ownership is checked: the selected variant must belong to the selected product.
- Quantities are constrained to integers from 1 to 99 in the application and RPC.
- The checkout does not decrement merely when adding to cart.

### Blockers

1. **No stock consumption:** `create_order_payment_atomic` only reads stock. It never performs `UPDATE ... SET stock = stock - qty` or records an inventory movement. `lib/repositories.ts:createOrderPaymentAtomic` does not call any inventory operation either.
2. **Race condition:** two concurrent requests can both read `stock = 1` and both create valid orders. There is no `FOR UPDATE`, conditional decrement, or equivalent atomic inventory function.
3. **Duplicate-line bypass:** the RPC validates each JSON item independently. Two entries for the same product/variant can each pass against the same stock value.
4. **No variant inventory model:** variant stock exists as a column but there is no inventory type, variant-required rule, ledger, or invariant that prevents use of generic product stock when a variant is required.
5. **No unique inventory:** there is no credential/code/unit table and no atomic assignment from `available` to `assigned`.

### V2 target

Introduce a server-owned inventory model with one atomic operation that normalizes/aggregates order lines, locks the relevant product/variant rows, decrements only when available quantity is sufficient, writes a ledger event, and assigns unique units in the same transaction. The operation must be idempotent by order/fulfillment identity.

## 6. Fulfillment Audit

### What we already have

- `order_fulfillments` with one fulfillment per order and states `pending`, `processing`, `delivered`, `failed`, `cancelled`.
- `fulfillment_events`.
- `fulfillment_items` with types `file`, `link`, `code`, `manual`.
- Admin server actions to prepare, add, update, delete, and deliver fulfillment.
- Private `digital-delivery` bucket.
- Customer access function `getCustomerFulfillmentItems(orderId, sessionId)`.

### Correct

- Fulfillment is separate from payment status.
- `admin_deliver_order_atomic` requires a digital order, a paid payment, and at least one fulfillment item in the final `20260911` definition.
- Customer delivery reads require matching order/session, digital delivery, a paid payment, and delivered fulfillment.
- File object paths are not returned in the customer-safe object; file items receive a five-minute signed URL.
- Fulfillment tables and storage content are intended to be service-role-only/private.

### Missing or wrong

- Fulfillment content is manually entered; no product-to-fulfillment-type enforcement exists.
- No unique credential/code assignment exists.
- No guest secure delivery mechanism exists.
- No customer library table exists.
- No email delivery is triggered after `delivered`.
- No email status or retry state exists.
- File delivery validation is implemented in `lib/repositories.ts`, but the resulting delivery is still not connected to an email/outbox lifecycle.

## 7. Payment Audit

### Existing payment core

`payments` and `payment_events` are created by `20260901_add_payment_core.sql`. Supported database methods include `slickpay`, `flexy`, `ccp`, `bank_transfer`, `cod`, `cib`, `edahabia`, and `bank`.

The current customer checkout intentionally allows only `flexy`, `ccp`, and `bank_transfer` in `app/(store)/checkout/actions.ts`. The final digital RPC still accepts legacy methods such as `cod`; the application layer rejects them for digital checkout.

### Correct

- Manual proof submission validates ownership through payment/order/session and uses `submit_payment_proof_atomic`.
- Admin verification/rejection is protected in `app/admin/actions.ts` by `isAdminAuthenticated()` and uses `admin_transition_payment_atomic`.
- Payment transitions are conditional on the current state, preventing verify-after-reject and reject-after-paid through the RPC.
- Payment amount is stored from the authoritative checkout total in the current digital checkout path.
- Payment proof bucket is private and signed URLs are short-lived.

### Missing or wrong for V2

- SlickPay is not implemented. `lib/payments/service.ts:createPaymentForOrder` explicitly rejects SlickPay pending official documentation/integration.
- No provider callback/webhook verification exists.
- Payment creation in the legacy helper `createPaymentForOrder` accepts a caller-provided amount and is not a replacement for the hardened checkout RPC.
- Payment events cover payment transitions, but not inventory, fulfillment, or email transitions.

## 8. Order Lifecycle Audit

### Current behavior

The legacy `orders.status` column supports physical-commerce values (`pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`). Digital customer UI derives display status from payment and fulfillment in `getMyOrders`/`getOrdersBySession`, rather than persisting a complete V2 order lifecycle.

The payment lifecycle is more precise: `pending`, `verification_required`, `paid`, `failed`, `rejected`, `cancelled`.

### Correct

- Order, payment, and fulfillment are separate records.
- Checkout creates order, order items, payment, and initial payment event in one RPC transaction.
- Existing physical-order columns are preserved for compatibility.

### Missing or inconsistent

- No explicit persisted `fulfillment_pending`/`delivered` order event model.
- Admin delivery does not update `orders.status`; customer code derives a display value instead.
- No invariant connects order state, payment state, inventory consumption, fulfillment, and email status.
- No order-level audit event table exists.

## 9. Guest vs Account Audit

### Current behavior

- Guests can place digital orders using the `session_id` cookie in `app/(store)/checkout/actions.ts`.
- Account routes require `customer_auth` in `middleware.ts`.
- Account orders are queried by the authenticated customer session in `getMyOrders`.
- Login identifies a profile by email and signs the profile session ID.

### Important gap

Registering an account does not generally migrate/link prior guest orders from a different guest session to the account. `registerCustomer` uses the current session or an existing profile session, but there is no order-linking migration by verified email and no account-library association.

V2 requires:

- guest secure delivery independent of account creation;
- optional account creation;
- verified account linking rules for prior guest orders;
- a persistent library/purchase record for account customers.

## 10. Email Audit

### Current state

No email provider, email queue, email outbox table, retry mechanism, delivery status, or secure guest email link was found.

`app/api/send-order-notification/route.ts` sends Telegram notifications using `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`; it is not an email implementation. `lib/order-contact-message.ts` generates a customer message for Telegram/Messenger, not email delivery.

### V2 requirement status

The rule “email both guests and account customers” is not implemented. This is a blocker for V2 delivery readiness. Fulfillment must remain successful if email fails, while email failure and retries must be recorded separately.

## 11. Security Audit

### Positive controls

- Payment proof files are uploaded to a private bucket with generated paths.
- Customer proof submission verifies `paymentId`, `orderId`, and session ownership.
- Admin payment mutations check the signed admin session server-side.
- Admin payment and fulfillment RPCs are granted to `service_role`, not ordinary roles.
- Customer fulfillment content is gated by session, paid payment, delivered fulfillment.

### Blockers/high-risk findings

1. `app/(store)/auth-actions.ts` defines `CUSTOMER_AUTH_SECRET` with fallback to `ADMIN_PANEL_PASSWORD` and finally a hardcoded string `edigiya-customer-auth-secret`. Missing configuration therefore does not fail closed, and customer auth signing is not independently guaranteed.
2. `middleware.ts` creates/accepts a plain `session_id` cookie. Guest operation is intentional, but the cookie is not an authenticated identity. Any server action that trusts a caller-supplied session ID must be restricted to its own server cookie and must not accept arbitrary IDs.
3. `app/(store)/actions.ts:getOrdersBySession(sessionId)` is an exported server action that accepts a session ID argument and calls the service-role repository. It is not bound internally to the authenticated/session cookie. It is an IDOR risk if reachable by a client.
4. `app/(store)/actions.ts:createOrder(data)` and repository legacy methods accept session/order/payment values from callers. They are not the hardened V2 checkout path and must be retired or protected before exposing the full system.
5. Base migrations use permissive policies such as `USING (true)` for carts, cart items, addresses, orders, order items, and customer profiles. The application currently relies on service-role access and application checks; direct anon/authenticated Supabase access is not safely isolated by those policies.

These are not to be hidden by UI changes. They require a security boundary decision before V2 implementation.

## 12. Idempotency & Concurrency Audit

### Already present

- `orders.checkout_idempotency_key` has a unique index.
- `create_order_payment_atomic` checks existing key/session and uses `ON CONFLICT`.
- Payment `idempotency_key` is unique.
- Payment proof transition is state-conditional.
- Admin payment transition is state-conditional.
- Fulfillment has one row per order and delivery is state-conditional.

### Missing

- Inventory decrement idempotency.
- Unique unit assignment idempotency.
- Email send idempotency.
- Fulfillment content delivery/access attempt idempotency.
- A complete audit event idempotency key/event uniqueness policy.

The current checkout idempotency prevents duplicate order/payment creation for the same checkout key, but it does not make inventory safe because no inventory operation exists.

## 13. V2 Gap Analysis

| Area | Current state | V2 state | Gap | Priority |
|---|---|---|---|---|
| Product | Basic product/variant/price | Product declares fulfillment and inventory behavior | Missing fields/rules | High |
| Inventory | Stock columns and pre-checks | Atomic consumption and ledger | No decrement/locking | Blocker |
| Variants | Price delta and stock | Sellable variant inventory | No complete invariant | High |
| Unique credentials | None | Individually assignable units | Missing data model/flow | Blocker |
| Cart | Session cart | Non-consuming cart | Mostly compatible | Medium |
| Checkout | Digital, authoritative price check | Atomic order/payment/inventory | Inventory absent | Blocker |
| Orders | Legacy status plus snapshots | Separate precise lifecycles/events | Incomplete event/state model | High |
| Payments | Manual proof/admin transitions | Provider-confirmed payment | SlickPay/callback absent | High |
| Flexy | Settings/proof/admin verification | Manual payment lifecycle | Mostly present | Medium |
| CCP/bank | Settings/proof/admin verification | Manual payment lifecycle | Mostly present | Medium |
| SlickPay | Explicitly not implemented | Server-confirmed provider | Missing | High |
| Payment proof | Private upload and atomic transition | Same | Mostly correct | Medium |
| Fulfillment | Manual content and delivery | Type-specific secure delivery | Assignment/email absent | Blocker |
| Guest delivery | None | Secure email access | Missing | Blocker |
| Account library | Order detail only | Persistent purchase/library | Missing | Blocker |
| Email | Telegram only | Email both guest/account | Missing | Blocker |
| Admin | Payment and manual fulfillment actions | Inventory/delivery/email/audit ops | Incomplete | High |
| RLS | Some private tables, permissive legacy policies | Real ownership boundaries | Must harden | High |
| Audit events | Payment/fulfillment events | Cross-domain event history | Missing inventory/email/order events | High |

## 14. Required Database Changes

Design and review these before implementation:

1. Add explicit product inventory/fulfillment configuration, with constraints for supported combinations.
2. Add variant sellability/inventory semantics and enforce product/variant consistency.
3. Add inventory ledger/movement records with actor, order, item, quantity, and idempotency key.
4. Add atomic inventory consumption RPC or integrate consumption into the authoritative checkout/payment boundary, with row locks/conditional updates and duplicate-line aggregation.
5. Add unique inventory units for credentials/codes, with statuses such as `available`, `assigned`, `delivered`, `revoked`; never expose raw secrets through public product queries.
6. Add assignment records linking one unit to one order item/fulfillment item, protected by unique constraints.
7. Add account purchase/library records and verified guest-to-account linking rules.
8. Add guest delivery access tokens as hashed, expiring, revocable records; never store usable tokens in plaintext.
9. Add email outbox/delivery-attempt state and idempotency constraints.
10. Add a cross-domain audit event table or clearly defined event tables for order, inventory, fulfillment, and email events.
11. Replace permissive customer-facing RLS policies with ownership-aware policies, or explicitly revoke direct client table access and keep all sensitive access in audited server functions.
12. Add constraints/indexes for order/payment/fulfillment relationships and event lookup.

Migration order should be additive and dependency-safe: product model → inventory model → order/payment integration → fulfillment/unit assignment → guest/account delivery → email/outbox → admin operations → hardening/QA. Existing physical columns must remain until compatibility is intentionally retired.

## 15. Required Code Changes

No code was changed in this audit. The implementation plan requires:

- Replace pre-check-only stock logic with one server/database atomic inventory operation.
- Aggregate repeated product/variant lines before validation/consumption.
- Make fulfillment type and inventory type part of product/admin validation.
- Add unique-unit allocation after authoritative payment success and before delivery.
- Create secure guest access page and account library page using server-side authorization.
- Add an email service adapter, outbox enqueue, delivery status, retry, and idempotent send handling.
- Trigger email for both guests and account customers; account presence must not suppress email.
- Keep payment `paid` and fulfillment `delivered` separate.
- Remove or harden legacy public server actions that accept arbitrary session IDs/amounts.
- Require independent, mandatory customer-auth signing configuration; fail closed.
- Add server-side authorization tests for order, proof, content, library, and guest-token access.
- Add Admin inventory, assignment, delivery, email retry, and audit views only after the service/database contracts are stable.

## 16. Current File → Target File Map

| Current file | Current responsibility | Target responsibility |
|---|---|---|
| `app/(store)/checkout/page.tsx` | Checkout UI/state | UI only; never inventory/payment authority |
| `app/(store)/checkout/actions.ts` | Checkout validation and RPC call | Server boundary for identity/input normalization only |
| `lib/repositories.ts` | Supabase service-role repository, payment/fulfillment access | Split into catalog, commerce, inventory, fulfillment, email repositories |
| `lib/payments/service.ts` | Manual proof/admin payment helpers | Provider abstraction plus manual and SlickPay adapters |
| `app/(store)/actions.ts` | Store, customer orders/profile, legacy order actions | Remove/harden legacy arbitrary-session operations |
| `app/(store)/auth-actions.ts` | Customer password/session auth | Mandatory independent secret and verified guest linking |
| `middleware.ts` | Session cookie and route checks | Keep routing only; do not treat unsigned guest cookie as authenticated identity |
| `app/admin/actions.ts` | Admin payment/fulfillment actions | Add inventory, unit assignment, email retry, audit operations |
| `app/admin/orders/[id]/page.tsx` | Admin order/payment/fulfillment UI | Compose separate lifecycle panels from audited server actions |
| `app/admin/orders/[id]/fulfillment-content-panel.tsx` | Manual fulfillment content | Type-specific content and unique-unit assignment UI |
| `app/(store)/account/page.tsx` | Session order list/profile | Add library/purchase access after delivery |
| `app/(store)/account/orders/[id]/page.tsx` | Customer order and delivered content | Keep order view; link to authorized library/delivery content |
| `app/api/send-order-notification/route.ts` | Telegram notification | Keep separate; do not use as email delivery; add email worker/action elsewhere |
| `lib/order-contact-message.ts` | Prepared customer contact message | Keep for support channels, not secure delivery |
| `supabase/migrations/20260901..20260911` | Current payment/fulfillment foundation | Preserve; add reviewed V2 migrations after dependency audit |

## 17. Migration Plan

### Phase 0 — Baseline and safety

- Confirm the actual remote schema and applied migrations.
- Snapshot existing orders, payments, order items, and fulfillment data.
- Define compatibility rules for legacy physical orders.
- Remove hardcoded auth-secret fallbacks and decide the direct-client/RLS boundary.

### Phase 1 — Product and inventory model

- Add product fulfillment/inventory types.
- Add variant rules.
- Add inventory movements and unique units.
- Implement and test atomic decrement/assignment.

### Phase 2 — Checkout integration

- Integrate atomic inventory consumption with the existing authoritative checkout flow.
- Preserve checkout idempotency.
- Ensure retries return the same result without another decrement or assignment.

### Phase 3 — Fulfillment

- Implement file/link/code/credentials/manual contracts.
- Add secure content authorization.
- Add unit assignment and fulfillment events.

### Phase 4 — Guest and account delivery

- Add expiring guest delivery access.
- Add account library records.
- Add verified linking for eligible guest orders.
- Keep email mandatory for both paths.

### Phase 5 — Email

- Add outbox/events, provider adapter, retry, and idempotency.
- Send order/payment/delivery/rejection notifications according to the V2 event policy.

### Phase 6 — Payment providers

- Keep Flexy/CCP/bank manual verification.
- Add SlickPay only after official API/callback details are available.
- Confirm server-side provider status before setting `paid`.

### Phase 7 — Admin and hardening

- Add inventory/unit/email/audit operations.
- Harden RLS and service boundaries.
- Add concurrency and authorization tests.

## 18. Implementation Phases

Recommended implementation sequence:

1. Security boundary and schema baseline.
2. Inventory quantity model and atomic decrement.
3. Variant inventory and duplicate-line handling.
4. Unique credential/code units and assignment.
5. Checkout integration and retry tests.
6. Fulfillment type contracts.
7. Account library and guest secure delivery.
8. Email outbox and delivery/retry.
9. Manual payment regression tests.
10. SlickPay provider discovery/implementation.
11. Admin operations and event timeline.
12. Full end-to-end QA.

Do not start SlickPay or broad UI redesign before phases 1–7 have stable contracts.

## 19. Risks

- Existing physical orders depend on legacy shipping/status columns; destructive replacement could break compatibility.
- Changing stock semantics can double-consume existing orders if historical orders are backfilled incorrectly.
- Credentials and activation codes are secrets; logs, public product reads, analytics, and client props must be reviewed.
- Service-role access can bypass RLS; every server action needs explicit ownership/authorization.
- Email failure must not roll back payment or fulfillment, but it must remain observable and retryable.
- Guest delivery links are bearer credentials and require expiry, revocation, hashing, and rate limiting.
- Account linking by email must require verified ownership and avoid merging two customers accidentally.
- Multiple local project copies caused runtime confusion; deployment and Git paths must be standardized.

## 20. QA Strategy

### Inventory

- finite stock 10 → purchase 1 → 9;
- purchase quantity greater than stock fails;
- two simultaneous final-unit requests produce exactly one success;
- duplicate product lines cannot bypass stock;
- variant stock is consumed from the selected variant only;
- unlimited products do not decrement;
- one unique credential/code cannot be assigned to two orders;
- retry after timeout does not decrement or assign twice.

### Payment/order

- one checkout key produces one order, one payment, and one creation event;
- amount is derived from database price/variant price;
- manual proof transitions to verification-required only with correct ownership;
- duplicate proof, verify, reject, verify-after-reject, and reject-after-paid are safe;
- payment `paid` does not imply fulfillment `delivered`.

### Delivery

- admin cannot deliver unpaid or contentless orders;
- file/link/code/credentials/manual each obeys its contract;
- guest cannot access another guest's order/content;
- content is unavailable before paid + delivered;
- account customer sees library content after delivery;
- guest receives secure email access;
- both guest and account customer receive email;
- email failure leaves fulfillment delivered and can be retried idempotently.

### Security

- direct anon/authenticated reads/writes against every sensitive table;
- forged session/customer/admin cookies;
- arbitrary order/payment/proof/content IDs;
- signed URL expiry and private bucket checks;
- service-role key absent from client bundles;
- audit event actor and idempotency checks.

## 21. Final Recommendation

The current project is a good foundation for V2 but is not ready for full implementation completion or real production fulfillment.

**WHAT WE ALREADY HAVE:** catalog, variants, carts, digital checkout, price/variant checks, manual payment methods, payment proof, admin payment transitions, private storage, basic fulfillment content, and customer delivered-content gating.

**WHAT IS CORRECT:** authoritative price calculation in the final digital RPC, payment state transitions, payment proof ownership checks, private proof storage, separate payment/fulfillment records, and basic checkout idempotency.

**WHAT IS MISSING:** authoritative inventory consumption, concurrency protection, unique credentials/codes, product fulfillment/inventory declarations, guest delivery, account library, email delivery for both identities, email retry state, SlickPay callbacks, and cross-domain audit events.

**WHAT IS WRONG:** stock is checked but never consumed; current legacy RLS/session boundaries are too permissive for a trusted production commerce system; customer-auth signing has a hardcoded fallback; legacy public server actions accept caller-supplied ownership/amount inputs.

**WHAT MUST CHANGE:** implement and test the inventory/unit model first, then delivery identity/email, then provider/admin expansion, while hardening security boundaries.

**WHAT SHOULD NOT BE TOUCHED:** legacy physical-order columns and historical data, the separation between payment and fulfillment, private payment-proof storage, existing manual payment records, and existing checkout/payment event history unless a compatibility migration explicitly preserves them.

**IMPLEMENTATION READINESS: NOT READY**

Reason: inventory correctness and secure guest/account delivery are not yet implemented, and there are unresolved security boundary issues that must be addressed before calling the V2 architecture production-ready.
