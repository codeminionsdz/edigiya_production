-- Allow a product identity to omit a base price when its commercial variants
-- provide the customer-facing prices. Non-variant products remain required to
-- have a price through the application and the guard below.
ALTER TABLE public.products
  ALTER COLUMN price_dzd DROP NOT NULL;

UPDATE public.product_variants
SET price_baridimob_dzd = COALESCE(price_baridimob_dzd, price_dzd),
    price_flexy_dzd = COALESCE(price_flexy_dzd, price_dzd)
WHERE price_dzd IS NOT NULL
  AND price_baridimob_dzd IS NULL
  AND price_flexy_dzd IS NULL;

CREATE OR REPLACE FUNCTION public.validate_product_base_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A nullable product may be bootstrapped inactive before its variants are
  -- inserted. Once it is active, it must either have a base price or a
  -- commercial variant.
  IF NEW.price_dzd IS NULL
     AND NEW.is_active = true
     AND NOT EXISTS (
       SELECT 1 FROM public.product_variants AS pv
       WHERE pv.product_id = NEW.id
     ) THEN
    RAISE EXCEPTION 'PRODUCT_PRICE_REQUIRED_FOR_NON_VARIANT_PRODUCT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_product_base_price ON public.products;
CREATE TRIGGER trigger_validate_product_base_price
BEFORE INSERT OR UPDATE OF price_dzd, is_active
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_base_price();

-- Keep the latest checkout RPC authoritative for nullable product prices and
-- variant-specific payment prices. Historical order snapshots are untouched.
CREATE OR REPLACE FUNCTION public.create_order_payment_atomic(
  p_order_number TEXT, p_checkout_key TEXT, p_session_id UUID, p_status TEXT,
  p_payment_method TEXT, p_subtotal NUMERIC, p_shipping NUMERIC, p_total NUMERIC,
  p_wilaya_code INTEGER, p_delivery_method TEXT, p_address_snapshot JSONB, p_items JSONB
) RETURNS TABLE(order_id UUID, payment_id UUID, order_number TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_order_id UUID; v_payment_id UUID; v_existing_session UUID;
  v_item JSONB; v_product RECORD; v_variant RECORD; v_qty INTEGER;
  v_unit NUMERIC; v_line NUMERIC; v_subtotal NUMERIC := 0;
  v_shipping NUMERIC := 0; v_total NUMERIC; v_method TEXT := p_payment_method;
  v_reservation_id UUID; v_reservation_item_id UUID; v_stock_reserved BOOLEAN;
BEGIN
  SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id
  FROM orders o LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.checkout_idempotency_key = p_checkout_key;
  IF v_order_id IS NOT NULL THEN
    IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id);
    RETURN;
  END IF;

  IF v_method NOT IN ('slickpay', 'flexy', 'ccp', 'bank_transfer') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method <> 'digital' THEN RAISE EXCEPTION 'INVALID_DELIVERY_METHOD'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'INVALID_ORDER_ITEMS'; END IF;
  PERFORM release_expired_inventory_reservations();

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id', COALESCE(value->>'variant_id', ''), value->>'qty' LOOP
    v_qty := (v_item->>'qty')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    SELECT pr.id, pr.title_fr, pr.price_dzd, pr.stock, pr.inventory_type, pr.is_active
    INTO v_product FROM products pr WHERE pr.id = (v_item->>'product_id')::UUID FOR UPDATE;
    IF NOT FOUND OR NOT v_product.is_active THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;

    IF NULLIF(v_item->>'variant_id', '') IS NOT NULL THEN
      SELECT pv.id, pv.product_id, pv.price_baridimob_dzd, pv.price_flexy_dzd, pv.stock, pv.is_active
      INTO v_variant FROM product_variants pv
      WHERE pv.id = (v_item->>'variant_id')::UUID FOR UPDATE;
      IF NOT FOUND OR v_variant.product_id <> v_product.id OR NOT v_variant.is_active THEN RAISE EXCEPTION 'INVALID_VARIANT'; END IF;
      IF v_variant.stock < v_qty THEN RAISE EXCEPTION 'VARIANT_OUT_OF_STOCK'; END IF;
      v_unit := CASE WHEN v_method = 'flexy' THEN v_variant.price_flexy_dzd ELSE v_variant.price_baridimob_dzd END;
      IF v_unit IS NULL OR v_unit < 0 THEN RAISE EXCEPTION 'VARIANT_PRICE_REQUIRED'; END IF;
    ELSE
      IF v_product.price_dzd IS NULL THEN RAISE EXCEPTION 'PRODUCT_PRICE_REQUIRED_FOR_NON_VARIANT_PRODUCT'; END IF;
      IF v_product.inventory_type = 'finite' AND v_product.stock < v_qty THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF;
      v_unit := v_product.price_dzd;
    END IF;
    v_line := v_unit * v_qty;
    v_subtotal := v_subtotal + v_line;
  END LOOP;

  v_total := v_subtotal + v_shipping;
  IF p_subtotal IS DISTINCT FROM v_subtotal OR p_shipping IS DISTINCT FROM v_shipping OR p_total IS DISTINCT FROM v_total THEN RAISE EXCEPTION 'CHECKOUT_TOTAL_MISMATCH'; END IF;

  INSERT INTO orders(order_number, checkout_idempotency_key, session_id, status, payment_method, subtotal_dzd, shipping_dzd, total_dzd, wilaya_code, delivery_method, address_snapshot)
  VALUES(p_order_number, p_checkout_key, p_session_id, 'pending', v_method, v_subtotal, v_shipping, v_total, NULL, 'digital', p_address_snapshot)
  ON CONFLICT(checkout_idempotency_key) DO NOTHING RETURNING id INTO v_order_id;
  IF v_order_id IS NULL THEN
    SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id
    FROM orders o LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.checkout_idempotency_key = p_checkout_key;
    IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id);
    RETURN;
  END IF;

  INSERT INTO inventory_reservations(order_id) VALUES(v_order_id) RETURNING id INTO v_reservation_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id', COALESCE(value->>'variant_id', ''), value->>'qty' LOOP
    v_qty := (v_item->>'qty')::INTEGER;
    SELECT pr.id, pr.price_dzd, pr.inventory_type INTO v_product FROM products pr WHERE pr.id = (v_item->>'product_id')::UUID FOR UPDATE;
    IF NULLIF(v_item->>'variant_id', '') IS NOT NULL THEN
      SELECT pv.id, pv.product_id INTO v_variant FROM product_variants pv WHERE pv.id = (v_item->>'variant_id')::UUID FOR UPDATE;
      UPDATE product_variants SET stock = stock - v_qty, updated_at = now() WHERE id = v_variant.id AND product_id = v_product.id AND stock >= v_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'VARIANT_OUT_OF_STOCK'; END IF;
      v_stock_reserved := true;
    ELSE
      v_stock_reserved := v_product.inventory_type = 'finite';
      IF v_stock_reserved THEN
        UPDATE products SET stock = stock - v_qty, updated_at = now() WHERE id = v_product.id AND stock >= v_qty;
        IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF;
      END IF;
    END IF;
    INSERT INTO inventory_reservation_items(reservation_id, product_id, variant_id, quantity, stock_reserved)
    VALUES(v_reservation_id, v_product.id, NULLIF(v_item->>'variant_id', '')::UUID, v_qty, v_stock_reserved)
    RETURNING id INTO v_reservation_item_id;
    INSERT INTO inventory_movements(order_id, reservation_id, product_id, variant_id, movement_type, quantity_delta, idempotency_key, metadata)
    VALUES(v_order_id, v_reservation_id, v_product.id, NULLIF(v_item->>'variant_id', '')::UUID, 'reserved', -CASE WHEN v_stock_reserved THEN v_qty ELSE 0 END, 'reservation:' || v_reservation_id || ':item:' || v_reservation_item_id || ':reserved', jsonb_build_object('stock_reserved', v_stock_reserved));
  END LOOP;

  INSERT INTO order_items(order_id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd)
  SELECT v_order_id, pr.id, pv.id, item->>'title_snapshot', (item->>'unit_price_dzd')::NUMERIC, (item->>'qty')::INTEGER, (item->>'line_total_dzd')::NUMERIC
  FROM jsonb_array_elements(p_items) item
  JOIN products pr ON pr.id = (item->>'product_id')::UUID
  LEFT JOIN product_variants pv ON pv.id = NULLIF(item->>'variant_id', '')::UUID AND pv.product_id = pr.id;
  INSERT INTO payments(order_id, method, provider, status, amount_dzd, idempotency_key)
  VALUES(v_order_id, v_method, NULL, 'pending', v_total, 'checkout:' || p_checkout_key)
  RETURNING id INTO v_payment_id;
  INSERT INTO payment_events(payment_id, event_type, actor_type, metadata)
  VALUES(v_payment_id, 'payment_created', 'customer', jsonb_build_object('amount_dzd', v_total, 'method', v_method, 'reservation_id', v_reservation_id));
  RETURN QUERY SELECT v_order_id, v_payment_id, p_order_number;
END $$;

REVOKE ALL ON FUNCTION public.validate_product_base_price() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_product_base_price() TO service_role;
