# 20260921 Live Verification Package

Run these metadata-only checks in Supabase SQL Editor after applying the
migration. Do not query Vault secret values except through the isolated,
approved QA delivery test; never print them in results or reports.

## Function definition and grants

```sql
SELECT
  p.oid::regprocedure AS identity_signature,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS security_definer,
  p.proconfig AS security_configuration
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_digital_unit_secret_for_session';

SELECT role_name,
       has_function_privilege(
         role_name,
         'public.get_digital_unit_secret_for_session(uuid,uuid,uuid)',
         'EXECUTE'
       ) AS can_execute
FROM (VALUES ('anon'::name), ('authenticated'::name), ('service_role'::name), ('postgres'::name)) AS roles(role_name);
```

Expected: `SECURITY DEFINER = true`, fixed empty `search_path`, anon and
authenticated cannot execute, service_role can execute.

## Relational authorization review

The function must require the exact order, allocation, order item, paid
payment, delivered fulfillment, current matching secret version, matching
unit, and signed session ownership. It must reject disabled/revoked units and
old/retired versions. It must not accept a Vault UUID argument.

## Runtime testing

The live database currently has zero digital units. Do not create fake
production records. If an isolated QA product/order/unit and approved QA Vault
secret are provisioned, test one authorized delivery and one denial for each
failed ownership/payment/fulfillment/allocation condition, then revoke/delete
QA data through the approved process. Never include the secret value in output.
