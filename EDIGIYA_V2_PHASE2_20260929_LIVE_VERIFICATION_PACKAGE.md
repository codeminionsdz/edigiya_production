# 20260929 Live Verification Package

Run only against approved live/QA data. Do not create fake production orders, digital units or Vault secrets. With `digital_inventory_units = 0`, the runtime cases below must be marked **NOT RUNTIME TESTABLE**.

## Structural and security checks

```sql
select to_regprocedure('public.get_account_digital_library(uuid)') as account_library_rpc,
       to_regprocedure('public.record_account_digital_delivery_access(uuid,uuid,uuid,text)') as account_audit_rpc,
       to_regprocedure('public.get_digital_unit_secret_for_session(uuid,uuid,uuid)') as account_secret_rpc,
       to_regprocedure('public.get_digital_unit_secret_for_session(uuid,uuid,uuid,text)') as guest_secret_rpc;

select p.oid::regprocedure as routine, p.prosecdef as security_definer,
       p.proconfig as settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.oid in (
    'public.get_account_digital_library(uuid)'::regprocedure,
    'public.record_account_digital_delivery_access(uuid,uuid,uuid,text)'::regprocedure,
    'public.get_digital_unit_secret_for_session(uuid,uuid,uuid)'::regprocedure,
    'public.get_digital_unit_secret_for_session(uuid,uuid,uuid,text)'::regprocedure
  );

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('get_account_digital_library', 'record_account_digital_delivery_access', 'get_digital_unit_secret_for_session')
order by routine_name, grantee;

select count(*) as digital_units from public.digital_inventory_units;
```

Expected: all four routines exist, are SECURITY DEFINER with `search_path = ''`, and have no PUBLIC/anon/authenticated EXECUTE. `digital_units` is currently 0.

## Account library checks

1. Sign in as an approved account that owns an already delivered digital order, if one exists.
2. Open `/account` and confirm only safe metadata appears: product title, order reference, type and delivered date.
3. Confirm no Vault UUID, allocation ID, token or secret appears before clicking reveal.
4. Click reveal, accept the privacy warning, and confirm the existing server action returns only the authorized secret.
5. Inspect browser Application storage and confirm no secret is in localStorage/sessionStorage.
6. Test an account from another session and an unpaid/undelivered order: no library item or secret access.

If no qualifying unit/order exists: **NOT RUNTIME TESTABLE**.

## Guest checks

1. Open an approved existing guest delivery link and confirm the token is not shown as page text.
2. Before reveal, confirm no secret is present in HTML or UI.
3. Accept the warning and confirm the page POSTs to `/api/digital-delivery/guest`.
4. Verify expired, revoked, unpaid, undelivered and malformed grants return only the generic error.
5. Inspect the URL and confirm it contains no raw secret or Vault UUID. The existing opaque grant token may remain in the delivery URL by design.

If no qualifying grant/unit exists: **NOT RUNTIME TESTABLE**.

## Regression and exposure checks

- Confirm manual payment remains `verification_required` until admin verification.
- Confirm payment/inventory/allocation/fulfillment state is unchanged by page access.
- Search client bundles and network responses for `vault_secret_id`, `decrypted_secret` and raw tokens; none should appear before authorized reveal.
- Confirm no new browser storage key is created by the feature.

No migration or live data mutation is required for this customer UI slice.

