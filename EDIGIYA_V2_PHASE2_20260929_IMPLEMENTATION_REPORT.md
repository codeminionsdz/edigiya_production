# Edigiya V2 — Phase 20260929 Customer Digital Delivery

## Status

**READY FOR LIVE VERIFICATION**

This slice adds the customer-facing layer only. It reuses the existing account library, account secret action, guest delivery API and Vault boundary. No migration, payment logic, inventory logic, allocation logic, fulfillment logic, email provider, or SlickPay code was changed.

## Delivered

- `components/store/digital-library.tsx`
  - safe delivered-item metadata from `getMyDigitalLibrary()`
  - explicit confirmation before reveal
  - explicit in-memory reveal and optional copy
  - no localStorage/sessionStorage or URL persistence
- `app/(store)/account/page.tsx`
  - account experience retains the existing orders/profile behavior and links to the digital library section
- `app/(store)/account/digital-library/page.tsx`
  - direct account library route using the same component
- `app/(store)/digital-delivery/page.tsx`
  - guest secure-delivery page
  - reads the existing opaque token only from the current URL at reveal time and sends it to the existing POST API
  - never renders the token or stores it persistently
- `lib/digital-email-worker.ts` now links guest emails to the reveal page instead of the legacy JSON GET response.
- `app/api/digital-delivery/guest/route.ts` redirects legacy GET links to the reveal page; POST remains the existing secret-returning server boundary.

## Security boundaries reused

Account metadata uses `get_account_digital_library` through `getMyDigitalLibrary`. Secret reveal uses `getMyDigitalSecret`, which records access and calls the existing `get_digital_unit_secret_for_session` boundary. Guest reveal uses `POST /api/digital-delivery/guest`, which uses the existing hashed-grant and Vault boundary. No browser component imports Supabase or Vault.

The account library is returned only for paid, digital, delivered, allocation-backed units with a current secret version. Guest authorization remains grant/payment/fulfillment/allocation gated by the existing SQL. The UI does not accept or send Vault UUIDs or internal unit IDs for retrieval.

Revealed plaintext exists only in React state for the current page lifetime and is displayed only after confirmation. It is not logged, placed in analytics, persisted, or added to URLs. The existing API/action response necessarily contains the authorized secret only after all backend checks pass.

## Localization and UX

The new views support French and Arabic labels, RTL direction, loading, empty, error, reveal and copy states. Manual-payment orders remain described by their existing payment/fulfillment state; the new UI does not claim delivery before the backend returns a delivered allocation-backed library item.

## Validation

- `npm run build`: PASS.
- `npx tsc --noEmit`: no new errors expected from this slice; existing project errors remain in `app/admin/navbar/page.tsx`, `app/admin/navbar/products/page.tsx`, and `nutrition-erp/src/...`.
- `git diff --check`: PASS.
- `npm run lint`: existing project issue; the script uses `next lint`, which is incompatible with the installed Next.js 16 CLI. Lint architecture was not changed.
- Static search reviewed new code for secret logging, persistent browser storage, URL/query secret storage, Vault imports and `vault_secret_id` exposure.

## Runtime limitation

The live database currently has zero `digital_inventory_units`. Account reveal, guest reveal, grant redemption and delivered-library runtime cases are therefore:

**NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**

No fake product, order, payment, digital unit, credential or Vault secret was created.
