# 20260923 Live Verification Package

Migration: `supabase/migrations/20260923_account_digital_delivery_access.sql`

Run in Supabase SQL Editor. These checks do not create/read Vault secrets or create fake digital units.

## 1. Objects and signatures

```sql
select
  to_regclass('public.digital_delivery_access_events') as access_events_table,
  to_regprocedure('public.get_account_digital_library(uuid)') as library_rpc,
  to_regprocedure('public.record_account_digital_delivery_access(uuid,uuid,uuid,text)') as access_rpc,
  to_regprocedure('public.get_digital_unit_secret_for_session(uuid,uuid,uuid)') as secret_rpc;
```

Expected: every result is non-NULL.

```sql
select
  p.oid::regprocedure as routine,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer,
  p.proconfig as settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_account_digital_library',
    'record_account_digital_delivery_access',
    'get_digital_unit_secret_for_session'
  )
order by 1;
```

Expected: all are SECURITY DEFINER and `settings` contains `search_path=`.

## 2. Schema, constraints, indexes, and RLS

```sql
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'digital_delivery_access_events'
order by ordinal_position;
```

Expected columns: `id`, `session_id`, `order_id`, `allocation_id`, `access_type`, `created_at`; no secret-bearing columns.

```sql
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.digital_delivery_access_events'::regclass
order by conname;
```

Expected: primary key, order/allocation foreign keys, access-type check, and unique `(session_id, order_id, allocation_id, access_type)`.

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'digital_delivery_access_events'
order by indexname;
```

Expected indexes:

```text
digital_delivery_access_events_order_idx
digital_delivery_access_events_session_idx
```

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'digital_delivery_access_events';
```

Expected: `relrowsecurity = true`.

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'digital_delivery_access_events'
order by grantee, privilege_type;
```

Expected: no `PUBLIC`, `anon`, or `authenticated` grants; `service_role` has required access.

## 3. Function grants

```sql
select
  has_function_privilege('public.get_account_digital_library(uuid)', 'execute') as public_library,
  has_function_privilege('anon', 'public.get_account_digital_library(uuid)', 'execute') as anon_library,
  has_function_privilege('authenticated', 'public.get_account_digital_library(uuid)', 'execute') as authenticated_library,
  has_function_privilege('service_role', 'public.get_account_digital_library(uuid)', 'execute') as service_library,
  has_function_privilege('public.record_account_digital_delivery_access(uuid,uuid,uuid,text)', 'execute') as public_access,
  has_function_privilege('anon', 'public.record_account_digital_delivery_access(uuid,uuid,uuid,text)', 'execute') as anon_access,
  has_function_privilege('authenticated', 'public.record_account_digital_delivery_access(uuid,uuid,uuid,text)', 'execute') as authenticated_access,
  has_function_privilege('service_role', 'public.record_account_digital_delivery_access(uuid,uuid,uuid,text)', 'execute') as service_access,
  has_function_privilege('public.get_digital_unit_secret_for_session(uuid,uuid,uuid)', 'execute') as public_secret,
  has_function_privilege('anon', 'public.get_digital_unit_secret_for_session(uuid,uuid,uuid)', 'execute') as anon_secret,
  has_function_privilege('authenticated', 'public.get_digital_unit_secret_for_session(uuid,uuid,uuid)', 'execute') as authenticated_secret,
  has_function_privilege('service_role', 'public.get_digital_unit_secret_for_session(uuid,uuid,uuid)', 'execute') as service_secret;
```

Expected: all `public_*`, `anon_*`, and `authenticated_*` values are false; all `service_*` values are true.

## 4. Delivery consistency checks

```sql
select count(*) as digital_inventory_units
from public.digital_inventory_units;
```

Expected current result: `0`.

Therefore unique-unit runtime checks are:

```text
NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS
```

```sql
select count(*) as orphan_access_events
from public.digital_delivery_access_events e
left join public.orders o on o.id = e.order_id
left join public.digital_unit_allocations a on a.id = e.allocation_id
where o.id is null or a.id is null;
```

Expected: `0`.

```sql
select count(*) as invalid_access_events
from public.digital_delivery_access_events e
join public.orders o on o.id = e.order_id
join public.digital_unit_allocations a on a.id = e.allocation_id
where o.session_id is distinct from e.session_id
   or o.delivery_method <> 'digital'
   or a.order_id is distinct from e.order_id
   or a.status not in ('allocated', 'consumed');
```

Expected: `0`.

```sql
select count(*) as invalid_allocation_fulfillment_links
from public.digital_fulfillment_allocations dfa
join public.order_fulfillments f on f.id = dfa.fulfillment_id
join public.orders o on o.id = dfa.order_id
join public.digital_unit_allocations a on a.id = dfa.allocation_id
where f.order_id is distinct from dfa.order_id
   or f.status <> 'delivered'
   or o.delivery_method <> 'digital'
   or a.order_id is distinct from dfa.order_id
   or dfa.status <> 'delivered';
```

Expected: `0` for valid allocation-backed delivered rows.

## 5. Runtime boundary

Do not run secret retrieval, create Vault secrets, insert inventory units, or create fake orders. With zero real digital units, these are NOT RUNTIME TESTABLE:

- account library row for a real allocated unit
- customer secret retrieval
- cross-account/foreign allocation rejection with live allocation data
- repeated access-event idempotency on a real delivery
- revoked/disabled/current-version runtime cases

The local implementation is ready for live verification; this package does not claim live verification.
