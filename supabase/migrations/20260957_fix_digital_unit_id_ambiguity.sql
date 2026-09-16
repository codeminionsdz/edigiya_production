-- Qualify RETURNING columns that have the same names as RETURNS TABLE fields.
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'reserve_digital_units_for_reservation'
  ORDER BY p.oid DESC LIMIT 1;

  IF v_definition IS NOT NULL THEN
    v_definition := replace(
      v_definition,
      'RETURNING id, digital_inventory_unit_id, reservation_slot, status',
      'RETURNING public.digital_unit_reservations.id, public.digital_unit_reservations.digital_inventory_unit_id, public.digital_unit_reservations.reservation_slot, public.digital_unit_reservations.status'
    );
    EXECUTE v_definition;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'allocate_digital_unit'
  ORDER BY p.oid DESC LIMIT 1;

  IF v_definition IS NOT NULL THEN
    v_definition := replace(
      v_definition,
      'RETURNING digital_inventory_unit_id, status, allocation_slot',
      'RETURNING public.digital_unit_allocations.digital_inventory_unit_id, public.digital_unit_allocations.status, public.digital_unit_allocations.allocation_slot'
    );
    EXECUTE v_definition;
  END IF;
END;
$$;
