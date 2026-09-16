# 20260915 — Live Verification Package

This package is for the established manual Supabase SQL Editor workflow.

Important:

- Run the migration once in the intended QA project first.
- Do not run the migration again if it succeeds.
- Do not create or query any real Vault secret.
- The UUIDs below are fake opaque references only; they are not Vault secrets.
- Do not run the negative inserts as a production data test.
- No live result is claimed by this package. Return the SQL Editor output for
  verification.

## 1. Migration to paste into SQL Editor

Paste and run the following exactly once:

```sql
-- Phase 2: digital inventory unit metadata foundation.
--
-- This migration stores only opaque Supabase Vault references. It does not
-- create, read, or migrate any Vault secret and does not change Phase 1 RPCs.

-- A composite key is required so a digital unit can enforce that its optional
-- variant belongs to the same product as the unit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_id_product_id_key'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_id_product_id_key UNIQUE (id, product_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.digital_inventory_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID,
  unit_type TEXT NOT NULL
    CHECK (unit_type IN ('credential', 'code')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'allocated', 'consumed', 'disabled', 'revoked')),
  vault_secret_id UUID NOT NULL,
  secret_version INTEGER NOT NULL DEFAULT 1
    CHECK (secret_version > 0),
  secret_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  secret_rotated_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  disabled_by TEXT,
  disabled_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_inventory_units_product_variant_fk
    FOREIGN KEY (variant_id, product_id)
    REFERENCES public.product_variants(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_inventory_units_vault_secret_unique
    UNIQUE (vault_secret_id)
);

CREATE INDEX IF NOT EXISTS digital_inventory_units_product_idx
  ON public.digital_inventory_units(product_id);

CREATE INDEX IF NOT EXISTS digital_inventory_units_variant_idx
  ON public.digital_inventory_units(variant_id)
  WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS digital_inventory_units_available_idx
  ON public.digital_inventory_units(product_id, variant_id, id)
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS digital_inventory_units_status_idx
  ON public.digital_inventory_units(status);

CREATE OR REPLACE FUNCTION public.update_digital_inventory_units_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_digital_inventory_units_updated_at
  ON public.digital_inventory_units;

CREATE TRIGGER trigger_update_digital_inventory_units_updated_at
BEFORE UPDATE ON public.digital_inventory_units
FOR EACH ROW
EXECUTE FUNCTION public.update_digital_inventory_units_updated_at();

ALTER TABLE public.digital_inventory_units ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.digital_inventory_units
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.digital_inventory_units TO service_role;

REVOKE ALL ON FUNCTION public.update_digital_inventory_units_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
```

## 2. Verification SQL

Run this after the migration. It inspects metadata and privileges only; it
does not read Vault payloads or call Vault functions.

```sql
-- Object and owner
select n.nspname as schema_name, c.relname as object_name, c.relkind,
       pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'digital_inventory_units';

-- Columns and types
select ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'digital_inventory_units'
order by ordinal_position;

-- Constraints, including product FK and product/variant composite FK
select con.conname,
       con.contype,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname = 'digital_inventory_units'
order by con.conname;

-- Supporting composite key on product_variants
select con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.product_variants'::regclass
  and con.conname = 'product_variants_id_product_id_key';

-- Indexes
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'digital_inventory_units'
order by indexname;

-- RLS and forced-RLS state
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where oid = 'public.digital_inventory_units'::regclass;

-- Effective table privileges: expected false for customer roles/PUBLIC and
-- true for service_role where the migration grants ALL.
select role_name,
       has_table_privilege(role_name, 'public.digital_inventory_units', 'SELECT') as can_select,
       has_table_privilege(role_name, 'public.digital_inventory_units', 'INSERT') as can_insert,
       has_table_privilege(role_name, 'public.digital_inventory_units', 'UPDATE') as can_update,
       has_table_privilege(role_name, 'public.digital_inventory_units', 'DELETE') as can_delete
from (values ('public'), ('anon'), ('authenticated'), ('service_role')) as roles(role_name);

-- Trigger function privileges: expected false for all listed API roles because
-- trigger execution does not require granting it to customer/API roles.
select role_name,
       has_function_privilege(role_name,
         'public.update_digital_inventory_units_updated_at()', 'EXECUTE') as can_execute
from (values ('public'), ('anon'), ('authenticated'), ('service_role')) as roles(role_name);

-- Explicitly confirm no Vault object was touched by this migration.
select count(*) as vault_rows_created_by_this_test
from information_schema.tables
where table_schema = 'vault'
  and table_name in ('secrets', 'decrypted_secrets');
```

Expected key results:

- one `public.digital_inventory_units` table;
- `vault_secret_id` is UUID and NOT NULL;
- product FK exists;
- composite `(variant_id, product_id)` FK references
  `product_variants(id, product_id)`;
- unit type and status CHECK constraints exist;
- unique constraint on `vault_secret_id` exists;
- four named indexes exist, in addition to the primary-key/unique indexes;
- RLS is enabled;
- `public`, `anon`, and `authenticated` have no table privileges;
- `service_role` has table privileges;
- no Vault secret was created or queried.

## 3. Safe positive test inserts

These tests use only fake UUID references and mark rows with
`PHASE2_QA_20260915`. They use existing product/variant rows only and do not
modify those rows.

First confirm the source rows exist:

```sql
select p.id as product_id, p.slug, pv.id as variant_id,
       pv.product_id as variant_product_id
from public.products p
left join public.product_variants pv on pv.product_id = p.id
where p.id is not null
limit 20;
```

Credential unit for a product that has at least one variant:

```sql
insert into public.digital_inventory_units
  (product_id, unit_type, status, vault_secret_id, secret_version,
   created_by, admin_note)
select pv.product_id, 'credential', 'available',
       '00000000-0000-0000-0000-000000000151'::uuid, 1,
       'phase2-qa', 'PHASE2_QA_20260915'
from public.product_variants pv
where not exists (
  select 1 from public.digital_inventory_units u
  where u.vault_secret_id = '00000000-0000-0000-0000-000000000151'::uuid
)
order by pv.product_id, pv.id
limit 1
returning id, product_id, variant_id, unit_type, status,
          vault_secret_id, secret_version, admin_note;
```

Code unit for a product without a variant requirement:

```sql
insert into public.digital_inventory_units
  (product_id, unit_type, status, vault_secret_id, secret_version,
   created_by, admin_note)
select p.id, 'code', 'available',
       '00000000-0000-0000-0000-000000000152'::uuid, 1,
       'phase2-qa', 'PHASE2_QA_20260915'
from public.products p
where not exists (
  select 1 from public.digital_inventory_units u
  where u.vault_secret_id = '00000000-0000-0000-0000-000000000152'::uuid
)
order by p.id
limit 1
returning id, product_id, variant_id, unit_type, status,
          vault_secret_id, secret_version, admin_note;
```

Variant-specific credential unit:

```sql
insert into public.digital_inventory_units
  (product_id, variant_id, unit_type, status, vault_secret_id,
   secret_version, created_by, admin_note)
select pv.product_id, pv.id, 'credential', 'available',
       '00000000-0000-0000-0000-000000000153'::uuid, 1,
       'phase2-qa', 'PHASE2_QA_20260915'
from public.product_variants pv
where not exists (
  select 1 from public.digital_inventory_units u
  where u.vault_secret_id = '00000000-0000-0000-0000-000000000153'::uuid
)
order by pv.product_id, pv.id
limit 1
returning id, product_id, variant_id, unit_type, status,
          vault_secret_id, secret_version, admin_note;
```

## 4. Negative tests

Each block must print the expected notice and must leave no row. These tests
use no real secret and do not alter product/variant rows.

Invalid `unit_type` — expected `CHECK constraint` failure:

```sql
do $$
begin
  begin
    insert into public.digital_inventory_units
      (product_id, unit_type, status, vault_secret_id, admin_note)
    select p.id, 'password', 'available',
           '00000000-0000-0000-0000-000000000161'::uuid,
           'PHASE2_QA_20260915'
    from public.products p order by p.id limit 1;
    raise exception 'NEGATIVE TEST FAILED: invalid unit_type accepted';
  exception when check_violation then
    raise notice 'PASS: invalid unit_type rejected';
  end;
end;
$$;
```

Invalid `status` — expected `CHECK constraint` failure:

```sql
do $$
begin
  begin
    insert into public.digital_inventory_units
      (product_id, unit_type, status, vault_secret_id, admin_note)
    select p.id, 'code', 'paid',
           '00000000-0000-0000-0000-000000000162'::uuid,
           'PHASE2_QA_20260915'
    from public.products p order by p.id limit 1;
    raise exception 'NEGATIVE TEST FAILED: invalid status accepted';
  exception when check_violation then
    raise notice 'PASS: invalid status rejected';
  end;
end;
$$;
```

Product/variant mismatch — expected FK failure. It requires at least two
products and a variant belonging to a different product:

```sql
do $$
begin
  begin
    insert into public.digital_inventory_units
      (product_id, variant_id, unit_type, status, vault_secret_id, admin_note)
    select p.id, pv.id, 'credential', 'available',
           '00000000-0000-0000-0000-000000000163'::uuid,
           'PHASE2_QA_20260915'
    from public.products p
    join public.product_variants pv on pv.product_id <> p.id
    order by p.id, pv.id
    limit 1;
    raise exception 'NEGATIVE TEST FAILED: product/variant mismatch accepted';
  exception when foreign_key_violation then
    raise notice 'PASS: product/variant mismatch rejected';
  end;
end;
$$;
```

## 5. Customer-role access tests

Run each statement independently if the SQL Editor stops after a permission
error. Expected result for `anon` and `authenticated` is permission denied for
SELECT/INSERT/UPDATE/DELETE. These tests do not query Vault.

```sql
-- Run as a role-capable SQL Editor operator; expected permission denied.
set local role anon;
select count(*) from public.digital_inventory_units;
reset role;
```

```sql
set local role anon;
insert into public.digital_inventory_units
  (product_id, unit_type, status, vault_secret_id, admin_note)
select p.id, 'code', 'available',
       '00000000-0000-0000-0000-000000000171'::uuid,
       'PHASE2_QA_20260915'
from public.products p order by p.id limit 1;
reset role;
```

Repeat the SELECT and INSERT blocks with `authenticated` in place of `anon`.
Also verify the metadata-only `has_table_privilege` result from Section 2.

## 6. Rollback-on-failure test

This proves a test insert is rolled back when a later statement fails. It uses
only a fake reference and an existing product, and ends with ROLLBACK.

```sql
begin;

insert into public.digital_inventory_units
  (product_id, unit_type, status, vault_secret_id, admin_note)
select p.id, 'code', 'available',
       '00000000-0000-0000-0000-000000000181'::uuid,
       'PHASE2_QA_20260915'
from public.products p order by p.id limit 1;

-- Deliberate failure; this statement must fail.
insert into public.digital_inventory_units
  (product_id, unit_type, status, vault_secret_id, admin_note)
select p.id, 'invalid', 'available',
       '00000000-0000-0000-0000-000000000182'::uuid,
       'PHASE2_QA_20260915'
from public.products p order by p.id limit 1;

rollback;
```

Afterward:

```sql
select count(*) as rollback_rows
from public.digital_inventory_units
where admin_note = 'PHASE2_QA_20260915'
  and vault_secret_id in (
    '00000000-0000-0000-0000-000000000181'::uuid,
    '00000000-0000-0000-0000-000000000182'::uuid
  );
```

Expected `rollback_rows = 0`.

## 7. Cleanup — only QA rows created by this package

Run after all tests. This targets only the fixed fake UUIDs and exact QA marker
used above; it does not delete products, variants, orders, reservations,
Vault rows, or any other inventory unit.

```sql
delete from public.digital_inventory_units
where admin_note = 'PHASE2_QA_20260915'
  and vault_secret_id in (
    '00000000-0000-0000-0000-000000000151'::uuid,
    '00000000-0000-0000-0000-000000000152'::uuid,
    '00000000-0000-0000-0000-000000000153'::uuid,
    '00000000-0000-0000-0000-000000000161'::uuid,
    '00000000-0000-0000-0000-000000000162'::uuid,
    '00000000-0000-0000-0000-000000000163'::uuid,
    '00000000-0000-0000-0000-000000000171'::uuid,
    '00000000-0000-0000-0000-000000000181'::uuid,
    '00000000-0000-0000-0000-000000000182'::uuid
  )
returning id, product_id, variant_id, unit_type, status, vault_secret_id;

select count(*) as remaining_qa_rows
from public.digital_inventory_units
where admin_note = 'PHASE2_QA_20260915'
  and vault_secret_id in (
    '00000000-0000-0000-0000-000000000151'::uuid,
    '00000000-0000-0000-0000-000000000152'::uuid,
    '00000000-0000-0000-0000-000000000153'::uuid,
    '00000000-0000-0000-0000-000000000161'::uuid,
    '00000000-0000-0000-0000-000000000162'::uuid,
    '00000000-0000-0000-0000-000000000163'::uuid,
    '00000000-0000-0000-0000-000000000171'::uuid,
    '00000000-0000-0000-0000-000000000181'::uuid,
    '00000000-0000-0000-0000-000000000182'::uuid
  );
```

Expected cleanup result: all returned QA rows are the rows created by this
package and `remaining_qa_rows = 0`.

## Live status

No live migration or test has been claimed by this package. Apply the SQL in
the intended QA environment, run the verification/negative/access/rollback
tests, clean the QA rows, and provide the SQL Editor results before
`20260915` is considered verified.

Do not proceed to `20260916` from this package alone.
