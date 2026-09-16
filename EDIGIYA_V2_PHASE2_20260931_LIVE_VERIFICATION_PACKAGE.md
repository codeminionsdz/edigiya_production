# 20260931 — SlickPay live verification package

Run only after configuring provider credentials in the server environment. Never paste credentials into SQL, logs, or the browser. Do not use a fake paid response.

## Preconditions

- Apply `supabase/migrations/20260931_slickpay_payment_integration.sql` after the existing migration chain.
- Set `SLICKPAY_API_KEY`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_SLICKPAY_ENABLED=true` server-side/public flag as appropriate.
- Use a disposable real QA order/product approved for payment testing; do not alter production orders.

## Checks

1. Select SlickPay and confirm the checkout action creates exactly one pending Edigiya payment with the authoritative order amount.
2. Confirm the SlickPay invoice amount equals `payments.amount_dzd`; the browser receives only the provider checkout URL.
3. Refresh/double-submit with the same checkout key and confirm one order, one payment, one invoice attempt, and one provider reference.
4. Return with valid order/payment parameters and confirm the server checks session ownership and the stored provider invoice ID. Query parameters alone must not mark payment paid.
5. Complete payment in SlickPay, return, and confirm server-side invoice details report completion; then confirm exactly one `payment_verified` provider event and `paid` status.
6. Repeat the return URL and confirm no duplicate event or state regression.
7. Use an amount-mismatch/foreign-payment request and confirm rejection without state change.
8. Confirm failed/inconclusive provider details leave Edigiya pending.
9. Confirm payment fulfillment starts only through the existing paid/delivered orchestration.
10. Re-run one Flexy, CCP, and Bank Transfer checkout/proof smoke test.

## SQL metadata checks

```sql
select to_regprocedure('public.claim_slickpay_invoice_attempt(uuid,text,numeric)'),
       to_regprocedure('public.complete_slickpay_invoice_attempt(uuid,uuid,text,text)'),
       to_regprocedure('public.fail_slickpay_invoice_attempt(uuid,uuid,text)'),
       to_regprocedure('public.record_slickpay_verification_atomic(uuid,text,boolean,text,numeric)');

select routine_name, routine_schema, security_type, routine_definition
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('claim_slickpay_invoice_attempt','complete_slickpay_invoice_attempt','fail_slickpay_invoice_attempt','record_slickpay_verification_atomic');

select grantee, routine_name, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('claim_slickpay_invoice_attempt','complete_slickpay_invoice_attempt','fail_slickpay_invoice_attempt','record_slickpay_verification_atomic')
order by routine_name, grantee;

select relname, relrowsecurity
from pg_class
where oid = 'public.slickpay_invoice_attempts'::regclass;
```

Expected: all routines exist, are SECURITY DEFINER with empty search path in their definitions, only service_role has EXECUTE, and the attempt table has RLS enabled. No Vault query is required or permitted.

## Runtime limitation

Until provider credentials and a controlled QA invoice are available, all provider calls and paid-state tests are `NOT RUNTIME TESTABLE — SLICKPAY NOT CONFIGURED`.
