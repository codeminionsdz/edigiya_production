# 20260928 Live Verification Package

Run in Supabase SQL Editor only after reviewing and applying the migration. These checks do not create units or Vault secrets unless a separate approved QA setup is added; with zero units, runtime creation tests remain not testable.

## 1. Structural checks

```sql
select to_regclass('public.digital_inventory_unit_operations') as operations_table,
       to_regprocedure('public.admin_create_digital_inventory_unit(uuid,uuid,text,text,uuid,text,text)') as create_rpc,
       to_regprocedure('public.admin_set_digital_inventory_unit_status(uuid,text,text)') as status_rpc;

select c.relname, c.relrowsecurity
from pg_class c
where c.oid in ('public.digital_inventory_units'::regclass,
                'public.digital_inventory_unit_operations'::regclass);

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('digital_inventory_units', 'digital_inventory_unit_operations')
order by table_name, ordinal_position;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.digital_inventory_units'::regclass,
                   'public.digital_inventory_unit_operations'::regclass)
order by table_name, conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('digital_inventory_units', 'digital_inventory_unit_operations')
order by tablename, indexname;
```

Expected: both tables and both RPCs are present; RLS is true; the operation idempotency key is unique; product/variant and unit-type constraints exist; no plaintext-secret column exists.

## 2. Function security and grants

```sql
select p.oid::regprocedure as routine,
       p.prosecdef as security_definer,
       pg_get_function_result(p.oid) as return_type,
       p.proconfig as settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.oid in (
    'public.admin_create_digital_inventory_unit(uuid,uuid,text,text,uuid,text,text)'::regprocedure,
    'public.admin_set_digital_inventory_unit_status(uuid,text,text)'::regprocedure
  );

select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('admin_create_digital_inventory_unit', 'admin_set_digital_inventory_unit_status')
order by routine_name, grantee;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('digital_inventory_units', 'digital_inventory_unit_operations')
order by table_name, grantee, privilege_type;
```

Expected: `security_definer = true`, `settings` contains `search_path=` with an empty value, `service_role` is the only intended EXECUTE/table grant, and PUBLIC/anon/authenticated are absent.

## 3. Safe metadata checks

```sql
select count(*) as digital_units from public.digital_inventory_units;
select count(*) as operation_rows from public.digital_inventory_unit_operations;

select count(*) as unsafe_columns
from information_schema.columns
where table_schema = 'public'
  and table_name in ('digital_inventory_units', 'digital_inventory_unit_operations')
  and lower(column_name) in ('secret', 'code', 'password', 'credential', 'decrypted_secret');
```

Expected with the current environment: `digital_units = 0`; `unsafe_columns = 0`. Do not query Vault decrypted views.

## 4. Runtime test status

Creation, duplicate submission, rotation, disable/revoke, browser-response and failure rollback tests are **NOT RUNTIME TESTABLE — ZERO DIGITAL INVENTORY UNITS** unless an approved isolated QA product/unit exists. Do not create fake production inventory or Vault secrets. Existing allocation/delivery regression verification should use the previous phase packages and remain unchanged.

