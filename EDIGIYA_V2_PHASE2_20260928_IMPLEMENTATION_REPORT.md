# Edigiya V2 — 20260928 Digital Inventory Admin Operations

## Status

**READY FOR LIVE VERIFICATION**

This slice adds the trusted admin operations layer only. No live Supabase mutation was performed and no Vault secret was created or read.

## Delivered

- `supabase/migrations/20260928_digital_inventory_admin_operations.sql`
  - idempotency/audit metadata table `digital_inventory_unit_operations`
  - service-role-only `admin_create_digital_inventory_unit(...)`
  - service-role-only `admin_set_digital_inventory_unit_status(...)`
  - product/variant validation, credential/code validation, and safe state transitions
  - all SECURITY DEFINER functions use `search_path = ''`
- Admin server actions and repository functions for listing/counts, creation, rotation, disable and revoke.
- Admin route `/admin/products/[id]/inventory` and a link from the products action menu.

## Secret safety

The browser submits the secret only to the server action. The server passes it to the existing `create_or_replace_digital_unit_secret` Vault boundary. The new SQL function discards the boundary return value and returns only safe unit metadata. No `vault_secret_id`, plaintext, Vault metadata, raw token or secret preview is selected by the inventory UI.

The operation table stores only product/variant/type, actor, idempotency key and the resulting unit id. It does not store plaintext or a secret fingerprint.

## Idempotency and lifecycle

`digital_inventory_unit_operations.idempotency_key` is unique. Replaying the same logical request returns the existing safe unit metadata; reusing the key for different product, variant or type is rejected. Vault version creation remains governed by the existing 20260919/20260920 function and its state restrictions.

Only `available` units may be disabled or revoked. Reserved, allocated and consumed units are rejected by the database function. Allocation and customer delivery functions were not modified.

## Existing architecture preserved

No payment, Phase 1 stock/reservation, allocation, fulfillment, guest grant, account library, email outbox/worker, or Vault retrieval function was changed. No trigger performs network I/O. No provider or SlickPay work was added.

## Validation

- `npm run build`: **PASS**. The new route `/admin/products/[id]/inventory` compiled successfully.
- `npx tsc --noEmit`: no new 20260928 errors. Existing errors remain in `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and `nutrition-erp/src/...`.
- `git diff --check`: **PASS**.
- `npm run lint`: the repository script is `next lint`, which is not supported by the installed Next.js 16 CLI and fails with `Invalid project directory ...\\lint`. No ESLint package/config was changed.
- Static review: new client code contains no Vault import, secret retrieval, secret rendering, storage path, or secret logging. New server actions require `isAdminAuthenticated()`.

## Runtime/live verification

Not performed in this slice. `digital_inventory_units` is currently empty, so tests requiring a real production digital unit are:

**NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**

The migration must be applied and verified through the accompanying SQL package before this slice is considered live-verified. Do not create fake units or Vault secrets.

