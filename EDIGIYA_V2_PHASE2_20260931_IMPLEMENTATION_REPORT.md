# Edigiya V2 — 20260931 implementation report

## Scope

This slice adds only the SlickPay payment boundary. Existing manual payment, inventory, fulfillment, Vault, guest delivery, account library, and email code paths were not changed.

## Implemented

- `lib/slickpay.ts`: server-only adapter for the documented invoice-create and invoice-details endpoints. It uses `SLICKPAY_API_KEY` only on the server and never returns the provider response or key.
- `lib/payments/slickpay-service.ts`: ownership-checked invoice creation and return verification. It uses the authoritative `payments.amount_dzd` and the existing session cookie.
- `app/(store)/checkout/actions.ts`: SlickPay selection and invoice creation after the existing atomic order/payment operation.
- `app/(store)/checkout/page.tsx` and `components/store/payment-experience.tsx`: minimal redirect UX. The browser redirects to the provider URL; it never changes payment state.
- `app/(store)/checkout/slickpay-return/page.tsx`: server-rendered return state that verifies the invoice before displaying “Paiement confirmé”.
- `supabase/migrations/20260931_slickpay_payment_integration.sql`: provider-safe metadata, durable invoice-attempt lease/idempotency records, and service-role-only RPCs.

## State and security

Invoice creation does not mark a payment paid. The verification RPC locks the payment, requires the stored SlickPay invoice ID, checks the provider amount against the authoritative payment amount, and records one provider verification event before transitioning a pending payment to `paid`. Unknown/non-completed responses remain pending.

Provider invoice creation is guarded by a unique payment attempt plus a five-minute lease. A retry reuses a created invoice; a concurrent request receives an in-progress error instead of creating a second invoice. Lease recovery is possible after expiry.

No webhook was added: the official documentation did not provide enough detail for a safe signature/replay implementation. The current boundary uses server-side invoice GET verification on return.

## Configuration

Server: `SLICKPAY_API_KEY` and `NEXT_PUBLIC_SITE_URL` are required. Client visibility is opt-in with `NEXT_PUBLIC_SLICKPAY_ENABLED=true`; this flag does not contain a secret and should only be enabled after provider configuration and QA.

The documented invoice API requires either a contact UUID or customer contact fields. This implementation sends the documented customer fields and a non-physical “Digital delivery” address because digital checkout has no shipping address.

## Validation

- `npm run build`: PASS.
- `npx tsc --noEmit`: existing unrelated errors remain in `app/admin/navbar/*` and `nutrition-erp/src/*`; no 20260931 error remains.
- `git diff --check`: PASS (line-ending warnings only).
- `npm run lint`: existing project script is incompatible with the installed Next.js 16 CLI (`next lint` interprets `lint` as a directory).
- Live provider tests: NOT RUNTIME TESTABLE — SlickPay credentials are not configured; no real invoice was created.

## Status

READY FOR LIVE VERIFICATION
