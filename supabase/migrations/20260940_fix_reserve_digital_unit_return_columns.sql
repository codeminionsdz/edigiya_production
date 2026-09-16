-- The reservation RPC has the same PL/pgSQL output-column shadowing bug as
-- the allocation RPC. Qualify INSERT RETURNING columns so retries reach the
-- canonical payment/delivery transaction.
CREATE OR REPLACE FUNCTION public.reserve_digital_units_for_reservation(
  p_order_id UUID,
  p_order_item_id UUID,
  p_reservation_id UUID,
  p_reservation_idempotency_key TEXT
)
RETURNS TABLE(
  reservation_unit_id UUID,
  digital_inventory_unit_id UUID,
  reservation_slot INTEGER,
  reservation_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item RECORD;
  v_reservation RECORD;
  v_reservation_item RECORD;
  v_unit RECORD;
  v_slot INTEGER := 0;
  v_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL OR p_order_item_id IS NULL OR p_reservation_id IS NULL
     OR p_reservation_idempotency_key IS NULL
     OR length(btrim(p_reservation_idempotency_key)) = 0
     OR length(p_reservation_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_RESERVATION_INPUT';
  END IF;

  UPDATE public.inventory_reservations AS reservation_row
  SET expires_at = now() + interval '30 minutes'
  WHERE reservation_row.id = p_reservation_id
    AND reservation_row.order_id = p_order_id
    AND reservation_row.status = 'active'
    AND reservation_row.expires_at <= now();

  SELECT reservation_row.order_id, reservation_row.status,
         reservation_row.expires_at INTO v_reservation
  FROM public.inventory_reservations AS reservation_row
  WHERE reservation_row.id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.order_id IS DISTINCT FROM p_order_id
     OR v_reservation.status <> 'active' OR v_reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_UNAVAILABLE';
  END IF;

  SELECT order_item_row.order_id, order_item_row.product_id,
         order_item_row.variant_id, order_item_row.qty INTO v_item
  FROM public.order_items AS order_item_row
  WHERE order_item_row.id = p_order_item_id FOR UPDATE;
  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH';
  END IF;

  SELECT reservation_item_row.product_id, reservation_item_row.variant_id,
         reservation_item_row.quantity INTO v_reservation_item
  FROM public.inventory_reservation_items AS reservation_item_row
  WHERE reservation_item_row.reservation_id = p_reservation_id
    AND reservation_item_row.product_id = v_item.product_id
    AND reservation_item_row.variant_id IS NOT DISTINCT FROM v_item.variant_id
  ORDER BY reservation_item_row.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_reservation_item.quantity IS DISTINCT FROM v_item.qty
     OR v_item.qty < 1 THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ITEM_MISMATCH';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.digital_unit_reservations AS digital_reservation_row
  WHERE digital_reservation_row.reservation_id = p_reservation_id
    AND digital_reservation_row.order_item_id = p_order_item_id
    AND digital_reservation_row.reservation_idempotency_key = p_reservation_idempotency_key;
  IF v_count > 0 THEN
    IF v_count <> v_item.qty THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_INCOMPLETE_RETRY'; END IF;
    RETURN QUERY SELECT digital_reservation_row.id,
      digital_reservation_row.digital_inventory_unit_id,
      digital_reservation_row.reservation_slot, digital_reservation_row.status
    FROM public.digital_unit_reservations AS digital_reservation_row
    WHERE digital_reservation_row.reservation_id = p_reservation_id
      AND digital_reservation_row.order_item_id = p_order_item_id
      AND digital_reservation_row.reservation_idempotency_key = p_reservation_idempotency_key
    ORDER BY digital_reservation_row.reservation_slot;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.digital_unit_reservations AS digital_reservation_row
    WHERE digital_reservation_row.reservation_id = p_reservation_id
      AND digital_reservation_row.order_item_id = p_order_item_id
  ) THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ALREADY_EXISTS'; END IF;

  FOR v_unit IN
    SELECT unit_row.id, unit_row.product_id, unit_row.variant_id
    FROM public.digital_inventory_units AS unit_row
    WHERE unit_row.product_id = v_item.product_id
      AND unit_row.variant_id IS NOT DISTINCT FROM v_item.variant_id
      AND unit_row.status = 'available'
    ORDER BY unit_row.created_at, unit_row.id
    LIMIT v_item.qty FOR UPDATE SKIP LOCKED
  LOOP
    v_slot := v_slot + 1;
    UPDATE public.digital_inventory_units AS unit_row
    SET status = 'reserved', updated_by = 'reservation_rpc'
    WHERE unit_row.id = v_unit.id AND unit_row.status = 'available';
    IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE'; END IF;

    INSERT INTO public.digital_unit_reservations AS reservation_row(
      digital_inventory_unit_id, reservation_id, order_id, order_item_id,
      product_id, variant_id, reservation_slot, status,
      reservation_idempotency_key, created_by, updated_by, metadata
    ) VALUES (
      v_unit.id, p_reservation_id, p_order_id, p_order_item_id,
      v_item.product_id, v_item.variant_id, v_slot, 'reserved',
      p_reservation_idempotency_key, 'reservation_rpc', 'reservation_rpc',
      jsonb_build_object('source', '20260937')
    )
    RETURNING reservation_row.id, reservation_row.digital_inventory_unit_id,
      reservation_row.reservation_slot, reservation_row.status
    INTO reservation_unit_id, digital_inventory_unit_id,
      reservation_slot, reservation_status;
    RETURN NEXT;
  END LOOP;

  IF v_slot <> v_item.qty THEN RAISE EXCEPTION 'DIGITAL_UNIT_INSUFFICIENT_AVAILABLE_UNITS'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT)
  TO service_role;
