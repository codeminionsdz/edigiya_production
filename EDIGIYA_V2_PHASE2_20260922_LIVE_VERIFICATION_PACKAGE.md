# 20260922 Live Verification Package

Migration: `supabase/migrations/20260922_digital_fulfillment_orchestration.sql`

This package is read-only except for the explicitly marked QA transaction. Do not create digital units or Vault secrets in the current environment: `digital_inventory_units` is currently empty, so runtime allocation is **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**.

## 1. Function and privilege checks

```sql
select
  p.oid::regprocedure as routine,
  p.prosecdef as security_definer,
  p.proconfig as settings,
  pg_get_function_result(p.oid) as return_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('orchestrate_digital_fulfillment', 'admin_deliver_order_atomic')
order by 1;

select
  has_function_privilege('public.orchestrate_digital_fulfillment(uuid,text)', 'execute') as public_orchestrate,
  has_function_privilege('anon', 'public.orchestrate_digital_fulfillment(uuid,text)', 'execute') as anon_orchestrate,
  has_function_privilege('authenticated', 'public.orchestrate_digital_fulfillment(uuid,text)', 'execute') as authenticated_orchestrate,
  has_function_privilege('service_role', 'public.orchestrate_digital_fulfillment(uuid,text)', 'execute') as service_orchestrate,
  has_function_privilege('public.admin_deliver_order_atomic(uuid,text)', 'execute') as public_deliver,
  has_function_privilege('anon', 'public.admin_deliver_order_atomic(uuid,text)', 'execute') as anon_deliver,
  has_function_privilege('authenticated', 'public.admin_deliver_order_atomic(uuid,text)', 'execute') as authenticated_deliver,
  has_function_privilege('service_role', 'public.admin_deliver_order_atomic(uuid,text)', 'execute') as service_deliver;
```

Expected: both routines exist, `security_definer = true`, `settings` contains `search_path=`, public/anon/authenticated execution is false, and service_role execution is true.

## 2. Schema, constraints, indexes, trigger, and RLS

```sql
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'digital_fulfillment_allocations'
order by ordinal_position;

select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.digital_fulfillment_allocations'::regclass
order by conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('digital_fulfillment_allocations','digital_unit_allocations')
order by tablename, indexname;

select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.digital_fulfillment_allocations'::regclass
  and not tgisinternal;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'digital_fulfillment_allocations';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'digital_fulfillment_allocations'
order by grantee, privilege_type;
```

Expected constraints include allocation/product, order-item/product, variant/product FKs; unique allocation; unique order-item/slot; and `allocation_slot > 0`. The table is RLS-enabled, with no anon/authenticated/public table grant and service_role access only.

## 3. Phase 1 regression and secret boundary checks

```sql
select to_regprocedure('public.create_order_payment_atomic(uuid,uuid,jsonb,text,text,text,text,text)') as checkout_rpc;
select to_regprocedure('public.reserve_digital_units_for_reservation(uuid,uuid,uuid,text)') as reservation_rpc;
select to_regprocedure('public.allocate_digital_unit(uuid,uuid,uuid,integer,text)') as allocation_rpc;

select count(*) as digital_inventory_units from public.digital_inventory_units;
```

Expected: existing RPCs remain present. Do not query Vault decrypted values or create secrets.

## 4. Runtime gate

With the current live count of zero digital units, do not manufacture QA production entities. Mark the following **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**:

- successful unique-unit orchestration
- quantity > available unique units
- allocation idempotency under a real order
- concurrent final-unit fulfillment
- variant-specific allocation
- missing/disabled/revoked unit behavior

When isolated QA inventory is provisioned through the approved process, the same paid digital order may be used to verify: one allocation per quantity slot, deterministic retry, concurrent serialization, current secret-version metadata validation, and no plaintext retrieval. The orchestration must be invoked only through `service_role`.

## 5. Cleanup

No QA rows are created by this package because the current live database has zero units and no fake production data is permitted. Therefore cleanup is a no-op. If a separately approved isolated QA fixture is used, remove only rows created by that fixture after verification and confirm its marker count is zero; never delete existing customer/order/payment/fulfillment rows.

## Result

This package does not claim live application or runtime verification. The local implementation status is **READY FOR LIVE VERIFICATION**.
