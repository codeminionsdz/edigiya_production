# Phase 2 — 20260916 Live Verification Package

This package is for manual execution in the Supabase SQL Editor. It is based
on the actual current schema and the local migration.

Safety rules:

- Do not create, read, or decrypt any real Vault secret.
- Use only an isolated QA project or already-existing rows explicitly marked
  `PHASE2_QA_20260916`.
- Do not create fake production orders, variants, reservations, or credentials.
- Do not modify `20260915`, Phase 1 RPCs, payment, or application code.
- Do not treat this package as evidence of live application.

## 1. PRE-FLIGHT

Run this metadata/source-row query first. It does not read Vault payloads.

```sql
select n.nspname as schema_name, c.relname as object_name, c.relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in (
  'digital_inventory_units', 'inventory_reservations',
  'inventory_reservation_items', 'orders', 'order_items'
))
or (n.nspname = 'vault' and c.relname in ('secrets', 'decrypted_secrets'))
order by schema_name, object_name;

select p.id as product_id, p.slug, pv.id as variant_id,
       pv.product_id as variant_product_id
from public.products p
left join public.product_variants pv on pv.product_id = p.id
order by p.id, pv.id
limit 20;

-- Only already-marked QA rows may be used for allocation tests.
select u.id as unit_id, u.product_id, u.variant_id, u.status,
       u.unit_type, u.admin_note
from public.digital_inventory_units u
where u.admin_note = 'PHASE2_QA_20260916'
order by u.created_at;

select o.id as order_id, o.order_number,
       oi.id as order_item_id, oi.product_id, oi.variant_id,
       r.id as reservation_id, r.status as reservation_status
from public.orders o
join public.order_items oi on oi.order_id = o.id
join public.inventory_reservations r on r.order_id = o.id
where o.order_number ilike 'qa-%'
order by o.created_at desc
limit 20;
```

If the last two queries do not return a complete compatible QA tuple, mark
valid allocation, lifecycle, duplicate, ownership, and rollback tests
`NOT TESTABLE`. Do not substitute real customer rows.

## 2. MIGRATION APPLICATION

The exact migration to paste is the complete contents of:

[supabase/migrations/20260916_digital_unit_allocation_foundation.sql](C:/Users/codem/OneDrive/project/egygiya/supabase/migrations/20260916_digital_unit_allocation_foundation.sql)

Expected SHA-256 of the local file:

`28D1F4E3718F70838B200D262453FEA379720F29288DE52D57465AD002015AB1`

Paste and run it once. Stop if SQL Editor reports an error. Do not claim it is
live-applied until the SQL Editor reports success.

## 3. SCHEMA VERIFICATION

```sql
select n.nspname as schema_name, c.relname as object_name,
       pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'digital_unit_allocations';

select ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'digital_unit_allocations'
order by ordinal_position;

select con.conname, con.contype,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname = 'digital_unit_allocations'
order by con.conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'digital_unit_allocations'
order by indexname;

select relname, relrowsecurity, relforcerowsecurity
from pg_class
where oid = 'public.digital_unit_allocations'::regclass;

select tg.tgname, pg_get_triggerdef(tg.oid) as definition
from pg_trigger tg
where tg.tgrelid = 'public.digital_unit_allocations'::regclass
  and not tg.tgisinternal
order by tg.tgname;
```

Expected constraints include:

- primary key on `id`;
- product-consistent unit FK;
- product-consistent order-item FK;
- optional product-consistent variant FK;
- `allocation_slot > 0`;
- lifecycle check with exactly `reserved`, `allocated`, `consumed`, `released`,
  `revoked`;
- unique `idempotency_key`;
- unique `(order_item_id, allocation_slot)`;
- RLS enabled.

## 4. VALID ALLOCATION TEST

Use only a complete QA tuple returned by PRE-FLIGHT. Replace every placeholder
with IDs from that same tuple. The unit must be `available` or `reserved`, and
the `order_item`, reservation, product, and optional variant must match.

Use a fake idempotency key and a non-secret Vault UUID. This does not create or
query a Vault secret.

```sql
insert into public.digital_unit_allocations
  (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
   product_id, variant_id, allocation_slot, status, idempotency_key,
   created_by, admin_note)
values
  ('<QA_UNIT_ID>'::uuid,
   '<QA_ORDER_ID>'::uuid,
   '<QA_ORDER_ITEM_ID>'::uuid,
   '<QA_RESERVATION_ID>'::uuid,
   '<QA_PRODUCT_ID>'::uuid,
   null, -- replace with the QA order_item variant_id when non-null
   1, 'reserved',
   'phase2-qa-20260916-valid-001',
   'phase2-qa', 'PHASE2_QA_20260916')
returning id, digital_inventory_unit_id, order_id, order_item_id,
          reservation_id, product_id, variant_id, allocation_slot,
          status, idempotency_key, admin_note;
```

If the QA order item has a variant, replace `null` with its variant UUID. If it
does not, the unit must also have `variant_id IS NULL`.

Expected: one allocation row with status `reserved`.

## 5. PRODUCT/VARIANT CONSISTENCY NEGATIVE TEST

Only run if PRE-FLIGHT found two different products and a variant belonging to
one of them. Replace placeholders so the product is deliberately different
from the variant/order item. Expected: `DIGITAL_UNIT_VARIANT_MISMATCH` or a
foreign-key error, and no row committed.

```sql
do $$
begin
  begin
    insert into public.digital_unit_allocations
      (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
       product_id, variant_id, allocation_slot, status, idempotency_key,
       admin_note)
    values
      ('<QA_UNIT_ID>'::uuid, '<QA_ORDER_ID>'::uuid,
       '<QA_ORDER_ITEM_ID>'::uuid, '<QA_RESERVATION_ID>'::uuid,
       '<DIFFERENT_PRODUCT_ID>'::uuid, '<VARIANT_ID>'::uuid, 99,
       'reserved', 'phase2-qa-20260916-variant-mismatch',
       'PHASE2_QA_20260916');
    raise exception 'NEGATIVE TEST FAILED: variant mismatch accepted';
  exception
    when foreign_key_violation or check_violation or raise_exception then
      raise notice 'PASS: product/variant mismatch rejected';
  end;
end;
$$;
```

If no actual variants exist, report exactly:

`NOT TESTABLE — no product_variants available.`

## 6. DUPLICATE UNIT TEST

Use a second compatible QA order item/reservation and the same unit as the
successful allocation. Expected: unique active-unit violation.

```sql
do $$
begin
  begin
    insert into public.digital_unit_allocations
      (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
       product_id, variant_id, allocation_slot, status, idempotency_key,
       admin_note)
    values
      ('<SAME_QA_UNIT_ID>'::uuid, '<SECOND_QA_ORDER_ID>'::uuid,
       '<SECOND_QA_ORDER_ITEM_ID>'::uuid, '<SECOND_QA_RESERVATION_ID>'::uuid,
       '<SAME_PRODUCT_ID>'::uuid, <SAME_VARIANT_OR_NULL>, 1,
       'reserved', 'phase2-qa-20260916-duplicate-unit',
       'PHASE2_QA_20260916');
    raise exception 'NEGATIVE TEST FAILED: duplicate active unit accepted';
  exception when unique_violation then
    raise notice 'PASS: duplicate active/consumed unit rejected';
  end;
end;
$$;
```

## 7. DUPLICATE ORDER ITEM / SLOT TEST

Use a second compatible QA unit and the same order item as the successful row.
Expected: unique `(order_item_id, allocation_slot)` violation.

```sql
do $$
begin
  begin
    insert into public.digital_unit_allocations
      (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
       product_id, variant_id, allocation_slot, status, idempotency_key,
       admin_note)
    values
      ('<SECOND_QA_UNIT_ID>'::uuid, '<QA_ORDER_ID>'::uuid,
       '<QA_ORDER_ITEM_ID>'::uuid, '<QA_RESERVATION_ID>'::uuid,
       '<QA_PRODUCT_ID>'::uuid, <QA_VARIANT_OR_NULL>, 1,
       'reserved', 'phase2-qa-20260916-duplicate-slot',
       'PHASE2_QA_20260916');
    raise exception 'NEGATIVE TEST FAILED: duplicate order item slot accepted';
  exception when unique_violation then
    raise notice 'PASS: duplicate order item/slot rejected';
  end;
end;
$$;
```

## 8. IDEMPOTENCY TEST

Use a different compatible QA unit/order item if available. Expected: unique
`idempotency_key` violation.

```sql
do $$
begin
  begin
    insert into public.digital_unit_allocations
      (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
       product_id, variant_id, allocation_slot, status, idempotency_key,
       admin_note)
    values
      ('<ANOTHER_QA_UNIT_ID>'::uuid, '<ANOTHER_QA_ORDER_ID>'::uuid,
       '<ANOTHER_QA_ORDER_ITEM_ID>'::uuid, '<ANOTHER_QA_RESERVATION_ID>'::uuid,
       '<ANOTHER_QA_PRODUCT_ID>'::uuid, <ANOTHER_QA_VARIANT_OR_NULL>, 1,
       'reserved', 'phase2-qa-20260916-valid-001',
       'PHASE2_QA_20260916');
    raise exception 'NEGATIVE TEST FAILED: duplicate idempotency key accepted';
  exception when unique_violation then
    raise notice 'PASS: duplicate idempotency key rejected';
  end;
end;
$$;
```

## 9. LIFECYCLE TESTS

The trigger implements exactly these legal transitions:

- `reserved → allocated`
- `allocated → consumed`
- `reserved → released`
- `allocated → released`
- `reserved → revoked`
- `allocated → revoked`
- same-state updates for terminal states.

The unit status must be changed to the matching state in the same transaction
before each allocation update (`allocated`, `consumed`, `available`, or
`revoked` respectively). Use only isolated QA rows. Example for
`reserved → allocated`:

```sql
begin;
update public.digital_inventory_units
set status = 'allocated', updated_by = 'phase2-qa'
where id = '<QA_UNIT_ID>'::uuid
  and admin_note = 'PHASE2_QA_20260916';

update public.digital_unit_allocations
set status = 'allocated', updated_by = 'phase2-qa'
where id = '<QA_ALLOCATION_ID>'::uuid
  and admin_note = 'PHASE2_QA_20260916';
commit;
```

Repeat with `allocated → consumed` and matching unit status `consumed`; use a
fresh QA allocation for `reserved → released` with unit status `available`, and
fresh QA rows for revoke paths. Do not reuse a consumed/released terminal row.

Illegal transition example: expected `INVALID_DIGITAL_UNIT_ALLOCATION_TRANSITION`:

```sql
update public.digital_unit_allocations
set status = 'reserved'
where id = '<CONSUMED_QA_ALLOCATION_ID>'::uuid
  and admin_note = 'PHASE2_QA_20260916';
```

## 10. STATE COMPATIBILITY

New allocations must start with `status = 'reserved'`. Expected rejection:

```sql
insert into public.digital_unit_allocations
  (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
   product_id, variant_id, allocation_slot, status, idempotency_key,
   admin_note)
values
  ('<QA_UNIT_ID>'::uuid, '<QA_ORDER_ID>'::uuid,
   '<QA_ORDER_ITEM_ID>'::uuid, '<QA_RESERVATION_ID>'::uuid,
   '<QA_PRODUCT_ID>'::uuid, <QA_VARIANT_OR_NULL>, 88, 'allocated',
   'phase2-qa-20260916-invalid-initial-state',
   'PHASE2_QA_20260916');
```

Also verify a `disabled` or `revoked` unit cannot be inserted as `reserved`.
Expected: `DIGITAL_UNIT_NOT_AVAILABLE_FOR_RESERVATION`.

## 11. OWNERSHIP / RELATIONSHIP VALIDATION

The trigger must reject these, each using isolated QA IDs:

- order ID different from the selected order item's order;
- reservation belonging to a different order;
- unit product different from order-item product;
- unit variant different from order-item variant;
- nullable variant mismatch where one side is NULL.

Expected messages include:

- `DIGITAL_UNIT_ALLOCATION_OWNERSHIP_MISMATCH`;
- `DIGITAL_UNIT_RESERVATION_MISMATCH`;
- `DIGITAL_UNIT_VARIANT_MISMATCH`;
- or the corresponding FK violation.

If the required isolated source rows do not exist, mark the specific test
`NOT TESTABLE`; do not use production rows.

## 12. CUSTOMER ACCESS / RLS

Run each independently. Expected result is permission denied for SELECT and
INSERT. Do not grant any role.

```sql
set local role anon;
select count(*) from public.digital_unit_allocations;
reset role;
```

```sql
set local role anon;
insert into public.digital_unit_allocations
  (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
   product_id, allocation_slot, status, idempotency_key)
values
  ('00000000-0000-0000-0000-000000000201'::uuid,
   '00000000-0000-0000-0000-000000000202'::uuid,
   '00000000-0000-0000-0000-000000000203'::uuid,
   '00000000-0000-0000-0000-000000000204'::uuid,
   '00000000-0000-0000-0000-000000000205'::uuid,
   1, 'reserved', 'phase2-qa-anon-insert');
reset role;
```

Repeat both with `authenticated`. Also run:

```sql
select role_name,
       has_table_privilege(role_name, 'public.digital_unit_allocations', 'SELECT') as can_select,
       has_table_privilege(role_name, 'public.digital_unit_allocations', 'INSERT') as can_insert,
       has_table_privilege(role_name, 'public.digital_unit_allocations', 'UPDATE') as can_update,
       has_table_privilege(role_name, 'public.digital_unit_allocations', 'DELETE') as can_delete
from (values ('public'), ('anon'), ('authenticated'), ('service_role')) as roles(role_name);
```

Expected: all customer/PUBLIC booleans false; `service_role` true.

## 13. ROLLBACK TEST

Use only a compatible QA tuple not used by another test.

```sql
begin;

insert into public.digital_unit_allocations
  (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
   product_id, variant_id, allocation_slot, status, idempotency_key,
   admin_note)
values
  ('<ROLLBACK_QA_UNIT_ID>'::uuid, '<ROLLBACK_QA_ORDER_ID>'::uuid,
   '<ROLLBACK_QA_ORDER_ITEM_ID>'::uuid, '<ROLLBACK_QA_RESERVATION_ID>'::uuid,
   '<ROLLBACK_QA_PRODUCT_ID>'::uuid, <ROLLBACK_QA_VARIANT_OR_NULL>, 77,
   'reserved', 'phase2-qa-20260916-rollback',
   'PHASE2_QA_20260916');

-- Deliberate failure; the whole transaction must be rolled back.
insert into public.digital_unit_allocations
  (digital_inventory_unit_id, order_id, order_item_id, reservation_id,
   product_id, allocation_slot, status, idempotency_key,
   admin_note)
values
  ('<ROLLBACK_QA_UNIT_ID>'::uuid, '<ROLLBACK_QA_ORDER_ID>'::uuid,
   '<ROLLBACK_QA_ORDER_ITEM_ID>'::uuid, '<ROLLBACK_QA_RESERVATION_ID>'::uuid,
   '<ROLLBACK_QA_PRODUCT_ID>'::uuid, 77, 'invalid',
   'phase2-qa-20260916-rollback-failure', 'PHASE2_QA_20260916');

rollback;
```

Expected afterward: no row with idempotency key
`phase2-qa-20260916-rollback`.

## 14. PHASE 1 REGRESSION SAFETY

The migration must not replace or drop Phase 1 RPCs. Run this metadata query
before and after if a baseline was captured:

```sql
select n.nspname as schema_name,
       p.oid::regprocedure as signature,
       md5(pg_get_functiondef(p.oid)) as definition_hash
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_order_payment_atomic',
    'admin_transition_payment_atomic',
    'consume_inventory_reservation',
    'release_inventory_reservation',
    'release_inventory_reservation_for_order',
    'release_expired_inventory_reservations'
  )
order by signature;
```

Expected: all previously present signatures remain present. This migration
contains no `CREATE OR REPLACE FUNCTION` for those Phase 1 functions and no
drop/alter operation against them.

## 15. CLEANUP

This deletes only allocation rows created by this package, identified by the
exact QA marker. It does not delete units, products, variants, orders,
reservations, Vault objects, or Phase 1 movements.

```sql
delete from public.digital_unit_allocations
where admin_note = 'PHASE2_QA_20260916'
returning id, digital_inventory_unit_id, order_id, order_item_id,
          reservation_id, status, idempotency_key;

select count(*) as remaining_qa_rows
from public.digital_unit_allocations
where admin_note = 'PHASE2_QA_20260916';
```

Expected: `remaining_qa_rows = 0`.

## 16. FINAL VERIFICATION QUERY

```sql
select count(*) as remaining_qa_rows,
       count(*) filter (where status = 'reserved') as reserved_rows,
       count(*) filter (where status = 'allocated') as allocated_rows,
       count(*) filter (where status = 'consumed') as consumed_rows,
       count(*) filter (where status = 'released') as released_rows,
       count(*) filter (where status = 'revoked') as revoked_rows
from public.digital_unit_allocations
where admin_note = 'PHASE2_QA_20260916';
```

All counts should be zero after cleanup.

## 17. PASS/FAIL/NOT TESTABLE matrix

| Check | Result to record |
|---|---|
| Migration applied once | PASS / FAIL |
| Schema and columns | PASS / FAIL |
| Primary key and relationships | PASS / FAIL |
| Product/variant consistency | PASS / FAIL / NOT TESTABLE — no variants |
| Constraints | PASS / FAIL |
| Indexes and uniqueness | PASS / FAIL |
| Valid allocation | PASS / FAIL / NOT TESTABLE — no compatible QA tuple |
| Duplicate unit | PASS / FAIL / NOT TESTABLE — no second QA tuple |
| Duplicate order item/slot | PASS / FAIL / NOT TESTABLE — no second QA unit |
| Idempotency key | PASS / FAIL / NOT TESTABLE — no second QA tuple |
| Lifecycle transitions | PASS / FAIL / NOT TESTABLE — no isolated allocation |
| State compatibility | PASS / FAIL / NOT TESTABLE |
| Ownership/relationships | PASS / FAIL / NOT TESTABLE |
| anon/authenticated RLS | PASS / FAIL |
| service_role access | PASS / FAIL |
| Rollback | PASS / FAIL / NOT TESTABLE |
| Phase 1 regression safety | PASS / FAIL |
| Cleanup | PASS / FAIL |

## Current status

Before execution, `20260916` is **LIVE UNVERIFIED**. Do not proceed to
`20260917` until the SQL Editor results are reviewed and every required check
is PASS or explicitly documented NOT TESTABLE for lack of safe isolated source
rows.
