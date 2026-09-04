-- Atomic checkout creation and server-owned retry identity.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_idempotency_key_idx
  ON orders(checkout_idempotency_key);

CREATE OR REPLACE FUNCTION create_order_payment_atomic(
  p_order_number TEXT,
  p_checkout_key TEXT,
  p_session_id UUID,
  p_status TEXT,
  p_payment_method TEXT,
  p_subtotal NUMERIC,
  p_shipping NUMERIC,
  p_total NUMERIC,
  p_wilaya_code INTEGER,
  p_delivery_method TEXT,
  p_address_snapshot JSONB,
  p_items JSONB
)
RETURNS TABLE(order_id UUID, payment_id UUID, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_payment_id UUID;
  v_inserted BOOLEAN;
BEGIN
  SELECT o.id, p.id INTO v_order_id, v_payment_id
  FROM orders o LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.checkout_idempotency_key = p_checkout_key;
  IF v_order_id IS NOT NULL THEN
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id);
    RETURN;
  END IF;

  INSERT INTO orders(order_number, checkout_idempotency_key, session_id, status, payment_method,
    subtotal_dzd, shipping_dzd, total_dzd, wilaya_code, delivery_method, address_snapshot)
  VALUES (p_order_number, p_checkout_key, p_session_id, p_status, p_payment_method,
    p_subtotal, p_shipping, p_total, p_wilaya_code, p_delivery_method, p_address_snapshot)
  ON CONFLICT (checkout_idempotency_key) DO NOTHING
  RETURNING id INTO v_order_id;
  v_inserted := v_order_id IS NOT NULL;
  IF NOT v_inserted THEN
    SELECT o.id, p.id INTO v_order_id, v_payment_id
    FROM orders o LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.checkout_idempotency_key = p_checkout_key;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id);
    RETURN;
  END IF;

  INSERT INTO order_items(order_id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd)
  SELECT v_order_id, (item->>'product_id')::UUID,
    NULLIF(item->>'variant_id', '')::UUID, item->>'title_snapshot',
    (item->>'unit_price_dzd')::NUMERIC, (item->>'qty')::INTEGER, (item->>'line_total_dzd')::NUMERIC
  FROM jsonb_array_elements(p_items) item;

  INSERT INTO payments(order_id, method, provider, status, amount_dzd, idempotency_key)
  VALUES (v_order_id, p_payment_method,
    CASE WHEN p_payment_method IN ('flexy','ccp','bank_transfer') THEN p_payment_method ELSE NULL END,
    'pending', p_total, 'checkout:' || p_checkout_key)
  RETURNING id INTO v_payment_id;

  INSERT INTO payment_events(payment_id, event_type, actor_type, metadata)
  VALUES (v_payment_id, 'payment_created', 'customer', jsonb_build_object('amount_dzd', p_total, 'method', p_payment_method));
  RETURN QUERY SELECT v_order_id, v_payment_id, p_order_number;
END;
$$;

REVOKE ALL ON FUNCTION create_order_payment_atomic(TEXT,TEXT,UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,INTEGER,TEXT,JSONB,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order_payment_atomic(TEXT,TEXT,UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,INTEGER,TEXT,JSONB,JSONB) TO service_role;
