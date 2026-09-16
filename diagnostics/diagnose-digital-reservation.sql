-- EDIGIYA — Digital reservation RPC diagnostic
--
-- DEFAULT BEHAVIOR: READ-ONLY.
-- This file does not modify application code or database objects.
--
-- The RPC test near the end is intentionally commented out. If enabled and
-- successful, it MAY create one digital reservation and change one unit from
-- available to reserved. Review all read-only output first.

-- ============================================================================
-- 1. FUNCTION SIGNATURE, DEFINITION, AND PROPERTIES
-- ============================================================================

SELECT
  p.oid::regprocedure AS function_signature,
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner_name,
  p.provolatile AS volatility_code,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END AS volatility,
  p.proconfig AS function_settings,
  array_to_string(p.proconfig, E'\n') AS search_path_or_other_settings
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'reserve_digital_units_for_reservation';

SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_functiondef(p.oid) AS full_function_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'reserve_digital_units_for_reservation';

-- Exact EXECUTE privileges for the RPC.
SELECT
  p.oid::regprocedure AS function_signature,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.routine_privileges AS rp
JOIN pg_proc AS p
  ON p.proname = rp.routine_name
JOIN pg_namespace AS n
  ON n.oid = p.pronamespace
WHERE rp.specific_schema = 'public'
  AND rp.routine_name = 'reserve_digital_units_for_reservation'
  AND n.nspname = 'public';

-- ============================================================================
-- 2. RELEVANT TABLE COLUMNS
-- ============================================================================

SELECT
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_schema,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'inventory_reservations',
    'digital_inventory_units',
    'digital_unit_reservations',
    'digital_unit_allocations',
    'order_items',
    'product_variants',
    'products'
  )
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 3. RELEVANT CONSTRAINTS AND FOREIGN KEYS
-- ============================================================================

SELECT
  ns.nspname AS schema_name,
  cls.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    WHEN 'x' THEN 'EXCLUSION'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM pg_constraint AS con
JOIN pg_class AS cls ON cls.oid = con.conrelid
JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN (
    'inventory_reservations',
    'digital_inventory_units',
    'digital_unit_reservations',
    'digital_unit_allocations',
    'order_items',
    'product_variants',
    'products'
  )
ORDER BY cls.relname, con.conname;

-- Indexes, including partial uniqueness used for concurrency/idempotency.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'inventory_reservations',
    'digital_inventory_units',
    'digital_unit_reservations',
    'digital_unit_allocations',
    'order_items',
    'product_variants',
    'products'
  )
ORDER BY tablename, indexname;

-- ============================================================================
-- 4. RELEVANT TRIGGERS
-- ============================================================================

SELECT
  trigger_schema,
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'inventory_reservations',
    'digital_inventory_units',
    'digital_unit_reservations',
    'digital_unit_allocations',
    'order_items',
    'product_variants',
    'products'
  )
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 5. CURRENT TEST DATA — READ ONLY
-- ============================================================================

SELECT
  o.id AS order_id,
  o.order_number,
  o.delivery_method,
  o.status AS order_status
FROM public.orders AS o
WHERE o.id = '18092cb8-4555-480e-9ab9-c2a2f5c5113b'::uuid;

SELECT
  oi.id AS order_item_id,
  oi.order_id,
  oi.product_id,
  oi.variant_id,
  oi.qty,
  p.fulfillment_type,
  p.title_fr AS product_title_fr
FROM public.order_items AS oi
JOIN public.products AS p ON p.id = oi.product_id
WHERE oi.id = 'ac247b22-3496-4406-9bf3-a0517297f5b5'::uuid;

SELECT
  r.id AS inventory_reservation_id,
  r.order_id,
  r.status,
  r.expires_at,
  r.created_at,
  r.consumed_at
FROM public.inventory_reservations AS r
WHERE r.id = '10c95b38-bc97-45d5-b01c-f7c39b38c2f3'::uuid;

SELECT
  ri.reservation_id,
  ri.product_id,
  ri.variant_id,
  ri.quantity
FROM public.inventory_reservation_items AS ri
WHERE ri.reservation_id = '10c95b38-bc97-45d5-b01c-f7c39b38c2f3'::uuid;

SELECT
  u.id AS digital_inventory_unit_id,
  u.product_id,
  u.variant_id,
  u.unit_type,
  u.status,
  u.secret_version,
  u.created_at
FROM public.digital_inventory_units AS u
WHERE u.product_id = (
  SELECT oi.product_id
  FROM public.order_items AS oi
  WHERE oi.id = 'ac247b22-3496-4406-9bf3-a0517297f5b5'::uuid
);

SELECT
  dur.id,
  dur.digital_inventory_unit_id,
  dur.reservation_id,
  dur.order_id,
  dur.order_item_id,
  dur.product_id,
  dur.variant_id,
  dur.reservation_slot,
  dur.status,
  dur.reservation_idempotency_key
FROM public.digital_unit_reservations AS dur
WHERE dur.order_id = '18092cb8-4555-480e-9ab9-c2a2f5c5113b'::uuid
   OR dur.reservation_id = '10c95b38-bc97-45d5-b01c-f7c39b38c2f3'::uuid;

SELECT
  dua.id,
  dua.digital_inventory_unit_id,
  dua.order_id,
  dua.order_item_id,
  dua.reservation_id,
  dua.product_id,
  dua.variant_id,
  dua.allocation_slot,
  dua.status,
  dua.idempotency_key
FROM public.digital_unit_allocations AS dua
WHERE dua.order_id = '18092cb8-4555-480e-9ab9-c2a2f5c5113b'::uuid
   OR dua.reservation_id = '10c95b38-bc97-45d5-b01c-f7c39b38c2f3'::uuid;

-- ============================================================================
-- 6. RPC EXECUTION TEST — DO NOT RUN BY DEFAULT
-- ============================================================================
-- RUN THIS ONLY AFTER REVIEWING THE READ-ONLY RESULTS.
-- WARNING: if it succeeds, this may create a digital reservation and change
-- one matching digital unit from available to reserved.
-- It is not a read-only query.
--
-- DO $$
-- BEGIN
--   PERFORM *
--   FROM public.reserve_digital_units_for_reservation(
--     '18092cb8-4555-480e-9ab9-c2a2f5c5113b'::uuid,
--     'ac247b22-3496-4406-9bf3-a0517297f5b5'::uuid,
--     '10c95b38-bc97-45d5-b01c-f7c39b38c2f3'::uuid,
--     'diagnostic-reservation-20260906'::text
--   );
-- EXCEPTION WHEN OTHERS THEN
--   RAISE NOTICE 'SQLSTATE=% MESSAGE=% DETAIL=% HINT=%',
--     SQLSTATE,
--     SQLERRM,
--     PG_EXCEPTION_DETAIL,
--     PG_EXCEPTION_HINT;
-- END $$;
