-- Fix PostgreSQL 42702 in the existing allocation primitive. The output
-- column names shadow table columns in its RETURNING clause; qualify the
-- source columns without changing the allocation state machine.
CREATE OR REPLACE FUNCTION public.allocate_digital_unit(
  p_order_id UUID,
  p_order_item_id UUID,
  p_reservation_id UUID,
  p_allocation_slot INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE(
  allocation_id UUID,
  digital_inventory_unit_id UUID,
  allocation_status TEXT,
  allocation_slot INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.digital_unit_allocations%ROWTYPE;
  v_item RECORD;
  v_reservation RECORD;
  v_bridge RECORD;
BEGIN
  IF p_order_id IS NULL OR p_order_item_id IS NULL OR p_reservation_id IS NULL
     OR p_allocation_slot IS NULL OR p_allocation_slot < 1
     OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_ALLOCATION_INPUT';
  END IF;

  SELECT a.* INTO v_existing
  FROM public.digital_unit_allocations AS a
  WHERE a.idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.order_id IS DISTINCT FROM p_order_id
       OR v_existing.order_item_id IS DISTINCT FROM p_order_item_id
       OR v_existing.reservation_id IS DISTINCT FROM p_reservation_id
       OR v_existing.allocation_slot IS DISTINCT FROM p_allocation_slot THEN
      RAISE EXCEPTION 'DIGITAL_UNIT_ALLOCATION_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.digital_inventory_unit_id,
      v_existing.status, v_existing.allocation_slot;
    RETURN;
  END IF;

  SELECT oi.order_id, oi.product_id, oi.variant_id, oi.qty INTO v_item
  FROM public.order_items AS oi WHERE oi.id = p_order_item_id FOR UPDATE;
  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id
     OR p_allocation_slot > v_item.qty THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH';
  END IF;

  SELECT r.order_id, r.status, r.expires_at INTO v_reservation
  FROM public.inventory_reservations AS r WHERE r.id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.order_id IS DISTINCT FROM p_order_id
     OR v_reservation.status <> 'active' OR v_reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_UNAVAILABLE';
  END IF;

  SELECT dur.* INTO v_bridge
  FROM public.digital_unit_reservations AS dur
  WHERE dur.reservation_id = p_reservation_id AND dur.order_id = p_order_id
    AND dur.order_item_id = p_order_item_id AND dur.product_id = v_item.product_id
    AND dur.variant_id IS NOT DISTINCT FROM v_item.variant_id
    AND dur.reservation_slot = p_allocation_slot AND dur.status = 'reserved'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_NOT_RESERVED_FOR_ORDER_ITEM'; END IF;

  INSERT INTO public.digital_unit_allocations(
    digital_inventory_unit_id, order_id, order_item_id, reservation_id,
    product_id, variant_id, allocation_slot, status, idempotency_key,
    created_by, updated_by, metadata
  ) VALUES (
    v_bridge.digital_inventory_unit_id, p_order_id, p_order_item_id,
    p_reservation_id, v_item.product_id, v_item.variant_id, p_allocation_slot,
    'reserved', p_idempotency_key, 'allocation_rpc', 'allocation_rpc',
    jsonb_build_object('source', '20260918')
  ) RETURNING id INTO allocation_id;

  UPDATE public.digital_inventory_units
  SET status = 'allocated', updated_by = 'allocation_rpc'
  WHERE id = v_bridge.digital_inventory_unit_id AND status = 'reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_STATUS_MISMATCH'; END IF;

  UPDATE public.digital_unit_reservations
  SET status = 'allocated', updated_by = 'allocation_rpc'
  WHERE id = v_bridge.id AND status = 'reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_STATE_MISMATCH'; END IF;

  UPDATE public.digital_unit_allocations AS allocation_row
  SET status = 'allocated', updated_by = 'allocation_rpc'
  WHERE allocation_row.id = allocation_id AND allocation_row.status = 'reserved'
  RETURNING allocation_row.digital_inventory_unit_id,
            allocation_row.status,
            allocation_row.allocation_slot
  INTO digital_inventory_unit_id, allocation_status, allocation_slot;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_digital_unit(UUID, UUID, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_digital_unit(UUID, UUID, UUID, INTEGER, TEXT)
  TO service_role;
