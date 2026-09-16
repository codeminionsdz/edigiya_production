-- Final product-only catalog model.
-- Legacy variant columns/tables remain for historical order readability. New
-- catalog, checkout, and fulfillment paths use products directly.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_dzd NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_baridimob_dzd NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_flexy_dzd NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_slickpay_dzd NUMERIC(10, 2);

-- Existing products keep their current base price as a safe starting point.
UPDATE public.products
SET price_baridimob_dzd = COALESCE(price_baridimob_dzd, price_dzd),
    price_flexy_dzd = COALESCE(price_flexy_dzd, price_dzd),
    price_slickpay_dzd = COALESCE(price_slickpay_dzd, price_dzd)
WHERE price_dzd IS NOT NULL;

ALTER TABLE public.digital_inventory_units
  ALTER COLUMN variant_id DROP NOT NULL;

DROP TRIGGER IF EXISTS trigger_require_variant_for_digital_inventory_unit
  ON public.digital_inventory_units;

CREATE INDEX IF NOT EXISTS digital_inventory_units_product_status_idx
  ON public.digital_inventory_units(product_id, status, created_at, id);

CREATE OR REPLACE FUNCTION public.sync_digital_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_product_id UUID := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE public.products p
  SET stock = (SELECT count(*)::INTEGER FROM public.digital_inventory_units u
               WHERE u.product_id = v_product_id AND u.status = 'available'),
      updated_at = now()
  WHERE p.id = v_product_id AND p.fulfillment_type IN ('credentials', 'code');
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Product-only admin inventory creation. The deprecated variant parameter is
-- retained for RPC compatibility but is never queried or validated.
CREATE OR REPLACE FUNCTION public.admin_create_digital_inventory_unit(
  p_product_id UUID, p_variant_id UUID, p_unit_type TEXT, p_secret TEXT,
  p_vault_key_id UUID, p_idempotency_key TEXT, p_actor TEXT DEFAULT 'admin'
)
RETURNS TABLE(unit_id UUID, product_id UUID, variant_id UUID, unit_type TEXT,
  status TEXT, secret_version INTEGER, secret_created_at TIMESTAMPTZ,
  created_by TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_operation public.digital_inventory_unit_operations%ROWTYPE;
  v_unit public.digital_inventory_units%ROWTYPE;
BEGIN
  IF p_product_id IS NULL OR p_unit_type NOT IN ('credential', 'code')
     OR p_secret IS NULL OR length(p_secret) = 0 OR length(p_secret) > 100000
     OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 255 THEN RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_INPUT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN RAISE EXCEPTION 'DIGITAL_UNIT_PRODUCT_NOT_FOUND'; END IF;
  INSERT INTO public.digital_inventory_unit_operations(idempotency_key, product_id, variant_id, unit_type, actor)
  VALUES (p_idempotency_key, p_product_id, NULL, p_unit_type, p_actor)
  ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT o.* INTO v_operation FROM public.digital_inventory_unit_operations o
  WHERE o.idempotency_key = p_idempotency_key FOR UPDATE;
  IF v_operation.product_id IS DISTINCT FROM p_product_id OR v_operation.variant_id IS NOT NULL
     OR v_operation.unit_type IS DISTINCT FROM p_unit_type THEN RAISE EXCEPTION 'DIGITAL_UNIT_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_operation.digital_inventory_unit_id IS NOT NULL THEN
    SELECT u.* INTO v_unit FROM public.digital_inventory_units u WHERE u.id = v_operation.digital_inventory_unit_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_OPERATION_INCOMPLETE'; END IF;
    RETURN QUERY SELECT v_unit.id, v_unit.product_id, NULL::UUID, v_unit.unit_type, v_unit.status,
      v_unit.secret_version, v_unit.secret_created_at, v_unit.created_by, v_unit.created_at; RETURN;
  END IF;
  INSERT INTO public.digital_inventory_units(product_id, variant_id, unit_type, status, vault_secret_id, secret_version, created_by, updated_by, admin_note)
  VALUES (p_product_id, NULL, p_unit_type, 'available', extensions.gen_random_uuid(), 1, p_actor, p_actor, 'Product-only admin inventory operation')
  RETURNING * INTO v_unit;
  PERFORM public.create_or_replace_digital_unit_secret(v_unit.id, p_secret, NULL, p_idempotency_key, p_actor);
  UPDATE public.digital_inventory_unit_operations SET digital_inventory_unit_id = v_unit.id WHERE id = v_operation.id;
  RETURN QUERY SELECT v_unit.id, v_unit.product_id, NULL::UUID, v_unit.unit_type, v_unit.status,
    v_unit.secret_version, v_unit.secret_created_at, v_unit.created_by, v_unit.created_at;
END;
$$;
DROP TRIGGER IF EXISTS trigger_sync_digital_product_stock ON public.digital_inventory_units;
CREATE TRIGGER trigger_sync_digital_product_stock
AFTER INSERT OR UPDATE OF product_id, status OR DELETE ON public.digital_inventory_units
FOR EACH ROW EXECUTE FUNCTION public.sync_digital_product_stock();

UPDATE public.products p
SET stock = (SELECT count(*)::INTEGER FROM public.digital_inventory_units u
             WHERE u.product_id = p.id AND u.status = 'available')
WHERE p.fulfillment_type IN ('credentials', 'code');

CREATE OR REPLACE FUNCTION public.reserve_digital_units_for_reservation(
  p_order_id UUID, p_order_item_id UUID, p_reservation_id UUID,
  p_reservation_idempotency_key TEXT
)
RETURNS TABLE(reservation_unit_id UUID, digital_inventory_unit_id UUID,
  reservation_slot INTEGER, reservation_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_item RECORD; v_reservation RECORD; v_reservation_item RECORD;
  v_unit RECORD; v_slot INTEGER := 0; v_count INTEGER := 0;
BEGIN
  SELECT r.order_id, r.status, r.expires_at INTO v_reservation
  FROM public.inventory_reservations r WHERE r.id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.order_id IS DISTINCT FROM p_order_id
     OR v_reservation.status <> 'active' OR v_reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_UNAVAILABLE';
  END IF;

  SELECT oi.order_id, oi.product_id, oi.qty INTO v_item
  FROM public.order_items oi WHERE oi.id = p_order_item_id FOR UPDATE;
  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id OR v_item.qty < 1 THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH';
  END IF;

  SELECT ri.product_id, ri.quantity INTO v_reservation_item
  FROM public.inventory_reservation_items ri
  WHERE ri.reservation_id = p_reservation_id AND ri.product_id = v_item.product_id
    AND ri.variant_id IS NULL
  ORDER BY ri.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_reservation_item.quantity IS DISTINCT FROM v_item.qty THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ITEM_MISMATCH';
  END IF;

  SELECT count(*) INTO v_count FROM public.digital_unit_reservations dur
  WHERE dur.reservation_id = p_reservation_id AND dur.order_item_id = p_order_item_id
    AND dur.reservation_idempotency_key = p_reservation_idempotency_key;
  IF v_count > 0 THEN
    IF v_count <> v_item.qty THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_INCOMPLETE_RETRY'; END IF;
    RETURN QUERY SELECT dur.id, dur.digital_inventory_unit_id, dur.reservation_slot, dur.status
    FROM public.digital_unit_reservations dur
    WHERE dur.reservation_id = p_reservation_id AND dur.order_item_id = p_order_item_id
      AND dur.reservation_idempotency_key = p_reservation_idempotency_key
    ORDER BY dur.reservation_slot;
    RETURN;
  END IF;

  FOR v_unit IN
    SELECT u.id FROM public.digital_inventory_units u
    WHERE u.product_id = v_item.product_id AND u.status = 'available'
    ORDER BY u.created_at, u.id LIMIT v_item.qty FOR UPDATE SKIP LOCKED
  LOOP
    v_slot := v_slot + 1;
    UPDATE public.digital_inventory_units
    SET status = 'reserved', updated_by = 'reservation_rpc', updated_at = now()
    WHERE id = v_unit.id AND status = 'available';
    IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE'; END IF;
    INSERT INTO public.digital_unit_reservations(
      digital_inventory_unit_id, reservation_id, order_id, order_item_id,
      product_id, variant_id, reservation_slot, status,
      reservation_idempotency_key, created_by, updated_by, metadata
    ) VALUES (
      v_unit.id, p_reservation_id, p_order_id, p_order_item_id,
      v_item.product_id, NULL, v_slot, 'reserved',
      p_reservation_idempotency_key, 'reservation_rpc', 'reservation_rpc',
      jsonb_build_object('product_only', true)
    )
    RETURNING id, digital_inventory_unit_id, reservation_slot, status
    INTO reservation_unit_id, digital_inventory_unit_id, reservation_slot, reservation_status;
    RETURN NEXT;
  END LOOP;
  IF v_slot <> v_item.qty THEN
    RAISE EXCEPTION 'Stock insuffisant - aucun compte disponible pour ce produit.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_order_payment_atomic(
  p_order_number TEXT, p_checkout_key TEXT, p_session_id UUID, p_status TEXT,
  p_payment_method TEXT, p_subtotal NUMERIC, p_shipping NUMERIC, p_total NUMERIC,
  p_wilaya_code INTEGER, p_delivery_method TEXT, p_address_snapshot JSONB, p_items JSONB
) RETURNS TABLE(order_id UUID, payment_id UUID, order_number TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_order_id UUID; v_payment_id UUID; v_existing_session UUID;
  v_item JSONB; v_product RECORD; v_qty INTEGER; v_unit NUMERIC; v_line NUMERIC;
  v_subtotal NUMERIC := 0; v_shipping NUMERIC := 0; v_total NUMERIC;
  v_reservation_id UUID; v_reservation_item_id UUID; v_stock_reserved BOOLEAN;
BEGIN
  SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id
  FROM public.orders o LEFT JOIN public.payments p ON p.order_id = o.id
  WHERE o.checkout_idempotency_key = p_checkout_key;
  IF v_order_id IS NOT NULL THEN
    IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM public.orders o WHERE o.id = v_order_id); RETURN;
  END IF;
  IF p_payment_method NOT IN ('baridimob', 'flexy', 'slickpay') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method <> 'digital' OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'INVALID_ORDER'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id', value->>'qty' LOOP
    v_qty := (v_item->>'qty')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    SELECT p.id, p.title_fr, p.stock, p.inventory_type, p.fulfillment_type, p.is_active,
      CASE p_payment_method WHEN 'baridimob' THEN p.price_baridimob_dzd
        WHEN 'flexy' THEN p.price_flexy_dzd ELSE p.price_slickpay_dzd END AS selected_price
    INTO v_product FROM public.products p WHERE p.id = (v_item->>'product_id')::UUID FOR UPDATE;
    IF NOT FOUND OR NOT v_product.is_active THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    IF v_product.selected_price IS NULL OR v_product.selected_price < 0 THEN RAISE EXCEPTION 'PRODUCT_PRICE_REQUIRED'; END IF;
    IF v_product.fulfillment_type IN ('credentials', 'code') THEN
      IF (SELECT count(*) FROM public.digital_inventory_units u WHERE u.product_id = v_product.id AND u.status = 'available') < v_qty THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF;
    ELSIF v_product.inventory_type = 'finite' AND v_product.stock < v_qty THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF;
    v_subtotal := v_subtotal + v_product.selected_price * v_qty;
  END LOOP;
  v_total := v_subtotal + v_shipping;
  IF p_subtotal IS DISTINCT FROM v_subtotal OR p_shipping IS DISTINCT FROM v_shipping OR p_total IS DISTINCT FROM v_total THEN RAISE EXCEPTION 'CHECKOUT_TOTAL_MISMATCH'; END IF;

  INSERT INTO public.orders(order_number, checkout_idempotency_key, session_id, status, payment_method, subtotal_dzd, shipping_dzd, total_dzd, wilaya_code, delivery_method, address_snapshot)
  VALUES(p_order_number, p_checkout_key, p_session_id, 'pending', p_payment_method, v_subtotal, v_shipping, v_total, p_wilaya_code, 'digital', p_address_snapshot)
  RETURNING id INTO v_order_id;
  INSERT INTO public.inventory_reservations(order_id) VALUES(v_order_id) RETURNING id INTO v_reservation_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id', value->>'qty' LOOP
    v_qty := (v_item->>'qty')::INTEGER;
    SELECT p.id, p.stock, p.inventory_type, p.fulfillment_type INTO v_product FROM public.products p WHERE p.id = (v_item->>'product_id')::UUID FOR UPDATE;
    v_stock_reserved := v_product.inventory_type = 'finite' AND v_product.fulfillment_type NOT IN ('credentials', 'code');
    IF v_stock_reserved THEN
      UPDATE public.products SET stock = stock - v_qty, updated_at = now() WHERE id = v_product.id AND stock >= v_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF;
    END IF;
    INSERT INTO public.inventory_reservation_items(reservation_id, product_id, variant_id, quantity, stock_reserved)
    VALUES(v_reservation_id, v_product.id, NULL, v_qty, v_stock_reserved) RETURNING id INTO v_reservation_item_id;
    INSERT INTO public.inventory_movements(order_id, reservation_id, product_id, variant_id, movement_type, quantity_delta, idempotency_key, metadata)
    VALUES(v_order_id, v_reservation_id, v_product.id, NULL, 'reserved', -CASE WHEN v_stock_reserved THEN v_qty ELSE 0 END,
      'reservation:' || v_reservation_id || ':item:' || v_reservation_item_id || ':reserved', jsonb_build_object('stock_reserved', v_stock_reserved, 'product_only', true));
  END LOOP;
  INSERT INTO public.order_items(order_id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd)
  SELECT v_order_id, p.id, NULL, item->>'title_snapshot', (item->>'unit_price_dzd')::NUMERIC, (item->>'qty')::INTEGER, (item->>'line_total_dzd')::NUMERIC
  FROM jsonb_array_elements(p_items) item JOIN public.products p ON p.id = (item->>'product_id')::UUID;
  INSERT INTO public.payments(order_id, method, provider, status, amount_dzd, idempotency_key)
  VALUES(v_order_id, p_payment_method, NULL, 'pending', v_total, 'checkout:' || p_checkout_key) RETURNING id INTO v_payment_id;
  INSERT INTO public.payment_events(payment_id, event_type, actor_type, metadata)
  VALUES(v_payment_id, 'payment_created', 'customer', jsonb_build_object('amount_dzd', v_total, 'method', p_payment_method, 'reservation_id', v_reservation_id));
  RETURN QUERY SELECT v_order_id, v_payment_id, p_order_number;
END;
$$;
