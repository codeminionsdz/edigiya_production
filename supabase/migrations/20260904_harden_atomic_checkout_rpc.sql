-- Harden the atomic checkout RPC before first remote application.
CREATE OR REPLACE FUNCTION create_order_payment_atomic(
  p_order_number TEXT, p_checkout_key TEXT, p_session_id UUID, p_status TEXT,
  p_payment_method TEXT, p_subtotal NUMERIC, p_shipping NUMERIC, p_total NUMERIC,
  p_wilaya_code INTEGER, p_delivery_method TEXT, p_address_snapshot JSONB, p_items JSONB
)
RETURNS TABLE(order_id UUID, payment_id UUID, order_number TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id UUID; v_payment_id UUID; v_existing_session UUID;
  v_item JSONB; v_product RECORD; v_variant RECORD;
  v_qty INTEGER; v_unit NUMERIC; v_line NUMERIC; v_subtotal NUMERIC := 0;
  v_shipping NUMERIC; v_total NUMERIC; v_method TEXT := p_payment_method;
BEGIN
  SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id
  FROM orders o LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.checkout_idempotency_key = p_checkout_key;
  IF v_order_id IS NOT NULL THEN
    IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id); RETURN;
  END IF;

  IF v_method NOT IN ('flexy','ccp','bank_transfer','cod','cib','edahabia','bank') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method NOT IN ('home','desk') THEN RAISE EXCEPTION 'INVALID_DELIVERY_METHOD'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'INVALID_ORDER_ITEMS'; END IF;

  SELECT sr.price_dzd INTO v_shipping FROM shipping_rates sr
  WHERE sr.wilaya_code = p_wilaya_code AND sr.method = CASE WHEN p_delivery_method = 'desk' THEN 'stopdesk' ELSE 'home' END;
  IF v_shipping IS NULL THEN RAISE EXCEPTION 'SHIPPING_RATE_NOT_FOUND'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT pr.id, pr.title_fr, pr.price_dzd, pr.stock, pr.is_active INTO v_product
    FROM products pr WHERE pr.id = (v_item->>'product_id')::UUID;
    IF NOT FOUND OR NOT v_product.is_active THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    v_qty := (v_item->>'qty')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    IF NULLIF(v_item->>'variant_id','') IS NOT NULL THEN
      SELECT pv.id, pv.product_id, pv.price_delta_dzd, pv.stock INTO v_variant
      FROM product_variants pv WHERE pv.id = (v_item->>'variant_id')::UUID;
      IF NOT FOUND OR v_variant.product_id <> v_product.id THEN RAISE EXCEPTION 'INVALID_VARIANT'; END IF;
      IF v_variant.stock < v_qty THEN RAISE EXCEPTION 'VARIANT_OUT_OF_STOCK'; END IF;
      v_unit := v_product.price_dzd + COALESCE(v_variant.price_delta_dzd, 0);
    ELSE
      IF v_product.stock IS NOT NULL AND v_product.stock < v_qty THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF;
      v_unit := v_product.price_dzd;
    END IF;
    v_line := v_unit * v_qty; v_subtotal := v_subtotal + v_line;
  END LOOP;
  v_total := v_subtotal + v_shipping;
  IF p_subtotal IS DISTINCT FROM v_subtotal OR p_shipping IS DISTINCT FROM v_shipping OR p_total IS DISTINCT FROM v_total THEN RAISE EXCEPTION 'CHECKOUT_TOTAL_MISMATCH'; END IF;

  INSERT INTO orders(order_number, checkout_idempotency_key, session_id, status, payment_method, subtotal_dzd, shipping_dzd, total_dzd, wilaya_code, delivery_method, address_snapshot)
  VALUES (p_order_number, p_checkout_key, p_session_id, 'pending', v_method, v_subtotal, v_shipping, v_total, p_wilaya_code, p_delivery_method, p_address_snapshot)
  ON CONFLICT (checkout_idempotency_key) DO NOTHING RETURNING id INTO v_order_id;
  IF v_order_id IS NULL THEN
    SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id FROM orders o LEFT JOIN payments p ON p.order_id = o.id WHERE o.checkout_idempotency_key = p_checkout_key;
    IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id); RETURN;
  END IF;

  INSERT INTO order_items(order_id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd)
  SELECT v_order_id, pr.id, pv.id, pr.title_fr,
    pr.price_dzd + COALESCE(pv.price_delta_dzd, 0), (item->>'qty')::INTEGER,
    (pr.price_dzd + COALESCE(pv.price_delta_dzd, 0)) * (item->>'qty')::INTEGER
  FROM jsonb_array_elements(p_items) item
  JOIN products pr ON pr.id = (item->>'product_id')::UUID
  LEFT JOIN product_variants pv ON pv.id = NULLIF(item->>'variant_id','')::UUID AND pv.product_id = pr.id;
  INSERT INTO payments(order_id, method, provider, status, amount_dzd, idempotency_key)
  VALUES (v_order_id, v_method, CASE WHEN v_method IN ('flexy','ccp','bank_transfer') THEN v_method ELSE NULL END, 'pending', v_total, 'checkout:' || p_checkout_key)
  RETURNING id INTO v_payment_id;
  INSERT INTO payment_events(payment_id, event_type, actor_type, metadata)
  VALUES (v_payment_id, 'payment_created', 'customer', jsonb_build_object('amount_dzd', v_total, 'method', v_method));
  RETURN QUERY SELECT v_order_id, v_payment_id, p_order_number;
END;
$$;

REVOKE ALL ON FUNCTION create_order_payment_atomic(TEXT,TEXT,UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,INTEGER,TEXT,JSONB,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order_payment_atomic(TEXT,TEXT,UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,INTEGER,TEXT,JSONB,JSONB) TO service_role;
