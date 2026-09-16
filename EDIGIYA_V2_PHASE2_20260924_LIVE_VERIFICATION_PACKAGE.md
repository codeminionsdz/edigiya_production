# 20260924 Live Verification Package

Migration: `supabase/migrations/20260924_guest_digital_delivery_grants.sql`

Run in Supabase SQL Editor. Do not create/read Vault secrets or create fake digital units.

## 1. Objects and signatures

```sql
select
  to_regclass('public.guest_digital_delivery_grants') as grants_table,
  to_regclass('public.guest_digital_delivery_access_events') as access_events_table,
  to_regprocedure('public.create_guest_digital_delivery_grant(uuid,uuid,uuid,uuid,text,timestamptz,text,text)') as create_grant_rpc,
  to_regprocedure('public.get_digital_unit_secret_for_session(uuid,uuid,uuid)') as account_secret_rpc,
  to_regprocedure('public.get_digital_unit_secret_for_session(uuid,uuid,uuid,text)') as guest_secret_rpc;
```

Expected: every result is non-NULL.

```sql
select p.oid::regprocedure as routine,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       pg_get_function_result(p.oid) as return_type,
       p.prosecdef as security_definer,
       p.proconfig as settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname = 'create_guest_digital_delivery_grant'
       or p.proname = 'get_digital_unit_secret_for_session')
order by 1;
```

Expected: all are SECURITY DEFINER and settings contain `search_path=`.

## 2. Schema, constraints, indexes, and RLS

```sql
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('guest_digital_delivery_grants', 'guest_digital_delivery_access_events')
order by table_name, ordinal_position;
```

Expected grant columns include `token_hash`, `grant_idempotency_key`, `expires_at`, `revoked_at`, `first_redeemed_at`, `last_redeemed_at`, and `redemption_count`; no plaintext token, Vault UUID, credential, or code column exists.

```sql
select conrelid::regclass as table_name, conname, contype,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.guest_digital_delivery_grants'::regclass,
                   'public.guest_digital_delivery_access_events'::regclass)
order by 1, 2;
```

Expected: primary keys, order/allocation/fulfillment foreign keys, access-type check, redemption check, unique token hash, unique grant idempotency key, and unique access-event grant ID.

```sql
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('guest_digital_delivery_grants', 'guest_digital_delivery_access_events')
order by tablename, indexname;
```

Expected indexes include `guest_digital_delivery_grants_order_idx`, `guest_digital_delivery_grants_allocation_idx`, and `guest_digital_delivery_grants_active_idx`.

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('guest_digital_delivery_grants', 'guest_digital_delivery_access_events');
```

Expected: `relrowsecurity = true` for both.

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('guest_digital_delivery_grants', 'guest_digital_delivery_access_events')
order by table_name, grantee, privilege_type;
```

Expected: no PUBLIC, anon, or authenticated grants; service_role has required access.

## 3. Function grants

```sql
select
  has_function_privilege('public.create_guest_digital_delivery_grant(uuid,uuid,uuid,uuid,text,timestamptz,text,text)', 'execute') as public_create,
  has_function_privilege('anon', 'public.create_guest_digital_delivery_grant(uuid,uuid,uuid,uuid,text,timestamptz,text,text)', 'execute') as anon_create,
  has_function_privilege('authenticated', 'public.create_guest_digital_delivery_grant(uuid,uuid,uuid,uuid,text,timestamptz,text,text)', 'execute') as authenticated_create,
  has_function_privilege('service_role', 'public.create_guest_digital_delivery_grant(uuid,uuid,uuid,uuid,text,timestamptz,text,text)', 'execute') as service_create,
  has_function_privilege('public.get_digital_unit_secret_for_session(uuid,uuid,uuid,text)', 'execute') as public_guest_secret,
  has_function_privilege('anon', 'public.get_digital_unit_secret_for_session(uuid,uuid,uuid,text)', 'execute') as anon_guest_secret,
  has_function_privilege('authenticated', 'public.get_digital_unit_secret_for_session(uuid,uuid,uuid,text)', 'execute') as authenticated_guest_secret,
  has_function_privilege('service_role', 'public.get_digital_unit_secret_for_session(uuid,uuid,uuid,text)', 'execute') as service_guest_secret;
```

Expected: public/anon/authenticated values are false; service_role values are true.

## 4. Safe consistency checks

```sql
select count(*) as digital_inventory_units
from public.digital_inventory_units;
```

Expected current result: `0`.

Therefore these are **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS**:

- valid guest grant creation
- expired/revoked grant rejection
- guest redemption and replay idempotency
- cross-order or cross-allocation rejection
- current-secret-version validation

```sql
select count(*) as orphan_guest_grants
from public.guest_digital_delivery_grants g
left join public.orders o on o.id = g.order_id
left join public.digital_unit_allocations a on a.id = g.allocation_id
left join public.order_fulfillments f on f.id = g.fulfillment_id
where o.id is null or a.id is null or f.id is null;
```

Expected: `0`.

```sql
select count(*) as invalid_guest_grants
from public.guest_digital_delivery_grants g
join public.orders o on o.id = g.order_id
join public.order_fulfillments f on f.id = g.fulfillment_id
join public.digital_fulfillment_allocations dfa on dfa.allocation_id = g.allocation_id
join public.digital_unit_allocations a on a.id = g.allocation_id
where o.delivery_method <> 'digital'
   or f.order_id is distinct from g.order_id
   or f.status <> 'delivered'
   or dfa.fulfillment_id is distinct from g.fulfillment_id
   or dfa.order_id is distinct from g.order_id
   or dfa.order_item_id is distinct from g.order_item_id
   or dfa.status <> 'delivered'
   or a.order_id is distinct from g.order_id
   or a.order_item_id is distinct from g.order_item_id
   or a.status not in ('allocated', 'consumed');
```

Expected: `0`.

```sql
select count(*) as invalid_access_events
from public.guest_digital_delivery_access_events e
left join public.guest_digital_delivery_grants g on g.id = e.grant_id
where g.id is null or e.redemption_count < 1;
```

Expected: `0`.

Do not query `vault.decrypted_secrets`, create Vault secrets, or select any secret value.
