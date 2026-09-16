-- Separate commercial price combinations from fulfillment package identity.
-- Payment method remains a price dimension only.
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS stock_variant_id UUID;
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_stock_variant_fk;
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_stock_variant_fk
  FOREIGN KEY (stock_variant_id, product_id)
  REFERENCES public.product_variants(id, product_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS product_variants_stock_variant_idx ON public.product_variants(stock_variant_id);

CREATE OR REPLACE FUNCTION public.resolve_stock_variant_id(p_variant_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(stock_variant_id, id) FROM public.product_variants WHERE id = p_variant_id;
$$;
REVOKE ALL ON FUNCTION public.resolve_stock_variant_id(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_stock_variant_id(UUID) TO service_role;

-- Exact package matching. The order variant remains the commercial price row;
-- inventory units are selected using its payment-independent stock_variant_id.
CREATE OR REPLACE FUNCTION public.reserve_digital_units_for_reservation(
  p_order_id UUID, p_order_item_id UUID, p_reservation_id UUID, p_reservation_idempotency_key TEXT
)
RETURNS TABLE(reservation_unit_id UUID, digital_inventory_unit_id UUID, reservation_slot INTEGER, reservation_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_item RECORD; v_reservation RECORD; v_reservation_item RECORD; v_unit RECORD;
  v_stock_variant_id UUID; v_slot INTEGER := 0; v_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL OR p_order_item_id IS NULL OR p_reservation_id IS NULL
     OR p_reservation_idempotency_key IS NULL OR length(btrim(p_reservation_idempotency_key)) = 0
     OR length(p_reservation_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_RESERVATION_INPUT';
  END IF;
  SELECT r.order_id, r.status, r.expires_at INTO v_reservation FROM public.inventory_reservations r WHERE r.id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.order_id IS DISTINCT FROM p_order_id OR v_reservation.status <> 'active' OR v_reservation.expires_at <= now() THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_UNAVAILABLE'; END IF;
  SELECT oi.order_id, oi.product_id, oi.variant_id, oi.qty INTO v_item FROM public.order_items oi WHERE oi.id = p_order_item_id FOR UPDATE;
  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id THEN RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH'; END IF;
  SELECT public.resolve_stock_variant_id(v_item.variant_id) INTO v_stock_variant_id;
  SELECT ri.product_id, ri.variant_id, ri.quantity INTO v_reservation_item FROM public.inventory_reservation_items ri WHERE ri.reservation_id = p_reservation_id AND ri.product_id = v_item.product_id AND ri.variant_id IS NOT DISTINCT FROM v_item.variant_id ORDER BY ri.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_reservation_item.quantity IS DISTINCT FROM v_item.qty OR v_item.qty < 1 THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ITEM_MISMATCH'; END IF;
  SELECT count(*) INTO v_count FROM public.digital_unit_reservations dur WHERE dur.reservation_id = p_reservation_id AND dur.order_item_id = p_order_item_id AND dur.reservation_idempotency_key = p_reservation_idempotency_key;
  IF v_count > 0 THEN
    IF v_count <> v_item.qty THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_INCOMPLETE_RETRY'; END IF;
    RETURN QUERY SELECT dur.id, dur.digital_inventory_unit_id, dur.reservation_slot, dur.status FROM public.digital_unit_reservations dur WHERE dur.reservation_id = p_reservation_id AND dur.order_item_id = p_order_item_id AND dur.reservation_idempotency_key = p_reservation_idempotency_key ORDER BY dur.reservation_slot;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.digital_unit_reservations dur WHERE dur.reservation_id = p_reservation_id AND dur.order_item_id = p_order_item_id) THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ALREADY_EXISTS'; END IF;
  FOR v_unit IN SELECT u.id FROM public.digital_inventory_units u WHERE u.product_id = v_item.product_id AND u.variant_id IS NOT DISTINCT FROM v_stock_variant_id AND u.status = 'available' ORDER BY u.created_at, u.id LIMIT v_item.qty FOR UPDATE SKIP LOCKED LOOP
    v_slot := v_slot + 1;
    UPDATE public.digital_inventory_units SET status = 'reserved', updated_by = 'reservation_rpc' WHERE id = v_unit.id AND status = 'available';
    IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE'; END IF;
    INSERT INTO public.digital_unit_reservations(digital_inventory_unit_id, reservation_id, order_id, order_item_id, product_id, variant_id, reservation_slot, status, reservation_idempotency_key, created_by, updated_by, metadata)
    VALUES (v_unit.id, p_reservation_id, p_order_id, p_order_item_id, v_item.product_id, v_item.variant_id, v_slot, 'reserved', p_reservation_idempotency_key, 'reservation_rpc', 'reservation_rpc', jsonb_build_object('stock_variant_id', v_stock_variant_id))
    RETURNING id, digital_inventory_unit_id, reservation_slot, status INTO reservation_unit_id, digital_inventory_unit_id, reservation_slot, reservation_status;
    RETURN NEXT;
  END LOOP;
  IF v_slot <> v_item.qty THEN RAISE EXCEPTION 'DIGITAL_UNIT_INSUFFICIENT_AVAILABLE_UNITS'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT) TO service_role;
