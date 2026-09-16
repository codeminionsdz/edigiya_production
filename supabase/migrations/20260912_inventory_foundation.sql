-- Phase 1: inventory foundation and atomic stock safety.
-- This migration does not change fulfillment, email, payment providers, or UI behavior.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_type TEXT NOT NULL DEFAULT 'finite',
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'manual';

-- Some deployments were created from the product-only baseline and do not
-- have the legacy table. Keep an empty compatibility table so historical
-- migration constraints can be applied; no new variant rows are created or
-- used by the product-only catalog.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'legacy',
  value TEXT NOT NULL DEFAULT 'legacy',
  price_delta_dzd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, name, value)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_inventory_type_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_inventory_type_check
      CHECK (inventory_type IN ('finite', 'unlimited'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_fulfillment_type_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_fulfillment_type_check
      CHECK (fulfillment_type IN ('file', 'link', 'code', 'credentials', 'manual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonnegative_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_nonnegative_check CHECK (stock >= 0);
  END IF;
  IF to_regclass('public.product_variants') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_stock_nonnegative_check') THEN
    ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_nonnegative_check CHECK (stock >= 0);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory_reservation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  stock_reserved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES inventory_reservations(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('reserved', 'released', 'consumed')),
  quantity_delta INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_expiry
  ON inventory_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_inventory_reservation_items_reservation
  ON inventory_reservation_items(reservation_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order
  ON inventory_movements(order_id);

-- New inventory records are service-role controlled. Existing application RLS is unchanged.
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON inventory_reservations, inventory_reservation_items, inventory_movements FROM PUBLIC, anon, authenticated;
GRANT ALL ON inventory_reservations, inventory_reservation_items, inventory_movements TO service_role;

CREATE OR REPLACE FUNCTION release_inventory_reservation(
  p_reservation_id UUID,
  p_target_status TEXT DEFAULT 'released'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation inventory_reservations;
  v_item inventory_reservation_items;
BEGIN
  IF p_target_status NOT IN ('released', 'expired') THEN
    RAISE EXCEPTION 'INVALID_RESERVATION_STATUS';
  END IF;

  SELECT * INTO v_reservation
  FROM inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND OR v_reservation.status <> 'active' THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT * FROM inventory_reservation_items
    WHERE reservation_id = v_reservation.id AND stock_reserved
    ORDER BY product_id, variant_id NULLS FIRST, id
  LOOP
    IF v_item.variant_id IS NULL THEN
      UPDATE products SET stock = stock + v_item.quantity, updated_at = now()
      WHERE id = v_item.product_id;
    ELSE
      UPDATE product_variants SET stock = stock + v_item.quantity, updated_at = now()
      WHERE id = v_item.variant_id AND product_id = v_item.product_id;
    END IF;

    INSERT INTO inventory_movements(
      order_id, reservation_id, product_id, variant_id, movement_type,
      quantity_delta, idempotency_key, metadata
    )
    SELECT v_reservation.order_id, v_reservation.id, v_item.product_id, v_item.variant_id,
      'released', v_item.quantity,
      'reservation:' || v_reservation.id || ':item:' || v_item.id || ':released',
      jsonb_build_object('reservation_status', p_target_status)
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_movements
      WHERE idempotency_key = 'reservation:' || v_reservation.id || ':item:' || v_item.id || ':released'
    );
  END LOOP;

  UPDATE inventory_reservations
  SET status = p_target_status, released_at = now()
  WHERE id = v_reservation.id AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION release_inventory_reservation_for_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_reservation_id UUID;
BEGIN
  SELECT id INTO v_reservation_id FROM inventory_reservations WHERE order_id = p_order_id;
  IF v_reservation_id IS NOT NULL THEN
    PERFORM release_inventory_reservation(v_reservation_id, 'released');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION release_expired_inventory_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_reservation IN
    SELECT id FROM inventory_reservations
    WHERE status = 'active' AND expires_at <= now()
    ORDER BY expires_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM release_inventory_reservation(v_reservation.id, 'expired');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION consume_inventory_reservation(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation inventory_reservations;
  v_item inventory_reservation_items;
BEGIN
  SELECT * INTO v_reservation
  FROM inventory_reservations
  WHERE order_id = p_order_id
  FOR UPDATE;

  -- Orders created before this migration have no reservation and remain compatible.
  IF NOT FOUND THEN RETURN; END IF;
  IF v_reservation.status = 'consumed' THEN RETURN; END IF;
  IF v_reservation.status <> 'active' THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_UNAVAILABLE';
  END IF;
  IF v_reservation.expires_at <= now() THEN
    PERFORM release_inventory_reservation(v_reservation.id, 'expired');
    RAISE EXCEPTION 'INVENTORY_RESERVATION_EXPIRED';
  END IF;

  FOR v_item IN
    SELECT * FROM inventory_reservation_items
    WHERE reservation_id = v_reservation.id
    ORDER BY id
  LOOP
    INSERT INTO inventory_movements(
      order_id, reservation_id, product_id, variant_id, movement_type,
      quantity_delta, idempotency_key, metadata
    ) VALUES (
      v_reservation.order_id, v_reservation.id, v_item.product_id, v_item.variant_id,
      'consumed', 0,
      'reservation:' || v_reservation.id || ':item:' || v_item.id || ':consumed',
      '{}'::jsonb
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  UPDATE inventory_reservations
  SET status = 'consumed', consumed_at = now()
  WHERE id = v_reservation.id AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION create_order_payment_atomic(
  p_order_number TEXT, p_checkout_key TEXT, p_session_id UUID, p_status TEXT,
  p_payment_method TEXT, p_subtotal NUMERIC, p_shipping NUMERIC, p_total NUMERIC,
  p_wilaya_code INTEGER, p_delivery_method TEXT, p_address_snapshot JSONB, p_items JSONB
)
RETURNS TABLE(order_id UUID, payment_id UUID, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_payment_id UUID;
  v_existing_session UUID;
  v_item JSONB;
  v_product RECORD;
  v_variant RECORD;
  v_qty INTEGER;
  v_unit NUMERIC;
  v_line NUMERIC;
  v_subtotal NUMERIC := 0;
  v_shipping NUMERIC := 0;
  v_total NUMERIC;
  v_method TEXT := p_payment_method;
  v_reservation_id UUID;
  v_reservation_item_id UUID;
  v_stock_reserved BOOLEAN;
BEGIN
  SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id
  FROM orders o LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.checkout_idempotency_key = p_checkout_key;
  IF v_order_id IS NOT NULL THEN
    IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id);
    RETURN;
  END IF;

  IF v_method NOT IN ('flexy', 'ccp', 'bank_transfer') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method <> 'digital' THEN RAISE EXCEPTION 'INVALID_DELIVERY_METHOD'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_ORDER_ITEMS';
  END IF;

  PERFORM release_expired_inventory_reservations();

  -- Lock every requested product/variant in a deterministic order before calculating totals.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY value->>'product_id', COALESCE(value->>'variant_id', ''), value->>'qty'
  LOOP
    v_qty := (v_item->>'qty')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

    SELECT pr.id, pr.title_fr, pr.price_dzd, pr.stock, pr.inventory_type, pr.is_active
    INTO v_product FROM products pr
    WHERE pr.id = (v_item->>'product_id')::UUID FOR UPDATE;
    IF NOT FOUND OR NOT v_product.is_active THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    -- A concurrent retry may have waited on this product lock while the first
    -- transaction committed. Re-check idempotency after the wait, before stock
    -- validation can turn a legitimate retry into an out-of-stock error.
    SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id
    FROM orders o LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.checkout_idempotency_key = p_checkout_key;
    IF v_order_id IS NOT NULL THEN
      IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
      RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id);
      RETURN;
    END IF;
    IF NULLIF(v_item->>'variant_id', '') IS NOT NULL THEN
      SELECT pv.id, pv.product_id, pv.price_delta_dzd, pv.stock
      INTO v_variant FROM product_variants pv
      WHERE pv.id = (v_item->>'variant_id')::UUID FOR UPDATE;
      IF NOT FOUND OR v_variant.product_id <> v_product.id THEN RAISE EXCEPTION 'INVALID_VARIANT'; END IF;
      IF v_variant.stock < v_qty THEN RAISE EXCEPTION 'VARIANT_OUT_OF_STOCK'; END IF;
      v_unit := v_product.price_dzd + COALESCE(v_variant.price_delta_dzd, 0);
    ELSE
      IF v_product.inventory_type = 'finite' AND v_product.stock < v_qty THEN
        RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK';
      END IF;
      v_unit := v_product.price_dzd;
    END IF;
    v_line := v_unit * v_qty;
    v_subtotal := v_subtotal + v_line;
  END LOOP;

  v_total := v_subtotal + v_shipping;
  IF p_subtotal IS DISTINCT FROM v_subtotal OR p_shipping IS DISTINCT FROM v_shipping OR p_total IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'CHECKOUT_TOTAL_MISMATCH';
  END IF;

  INSERT INTO orders(
    order_number, checkout_idempotency_key, session_id, status, payment_method,
    subtotal_dzd, shipping_dzd, total_dzd, wilaya_code, delivery_method, address_snapshot
  ) VALUES (
    p_order_number, p_checkout_key, p_session_id, 'pending', v_method,
    v_subtotal, v_shipping, v_total, NULL, 'digital', p_address_snapshot
  ) ON CONFLICT (checkout_idempotency_key) DO NOTHING RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT o.id, o.session_id, p.id INTO v_order_id, v_existing_session, v_payment_id
    FROM orders o LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.checkout_idempotency_key = p_checkout_key;
    IF v_existing_session <> p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF;
    RETURN QUERY SELECT v_order_id, v_payment_id, (SELECT o.order_number FROM orders o WHERE o.id = v_order_id);
    RETURN;
  END IF;

  INSERT INTO inventory_reservations(order_id) VALUES (v_order_id) RETURNING id INTO v_reservation_id;

  -- The row locks acquired above are held until commit. Decrement only finite stock.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY value->>'product_id', COALESCE(value->>'variant_id', ''), value->>'qty'
  LOOP
    v_qty := (v_item->>'qty')::INTEGER;
    SELECT pr.id, pr.inventory_type INTO v_product FROM products pr
    WHERE pr.id = (v_item->>'product_id')::UUID FOR UPDATE;
    IF NULLIF(v_item->>'variant_id', '') IS NOT NULL THEN
      SELECT pv.id, pv.product_id INTO v_variant FROM product_variants pv
      WHERE pv.id = (v_item->>'variant_id')::UUID FOR UPDATE;
      UPDATE product_variants SET stock = stock - v_qty, updated_at = now()
      WHERE id = v_variant.id AND product_id = v_product.id AND stock >= v_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'VARIANT_OUT_OF_STOCK'; END IF;
      v_stock_reserved := true;
    ELSE
      v_stock_reserved := v_product.inventory_type = 'finite';
      IF v_stock_reserved THEN
        UPDATE products SET stock = stock - v_qty, updated_at = now()
        WHERE id = v_product.id AND stock >= v_qty;
        IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF;
      END IF;
    END IF;
    INSERT INTO inventory_reservation_items(reservation_id, product_id, variant_id, quantity, stock_reserved)
    VALUES (v_reservation_id, v_product.id, NULLIF(v_item->>'variant_id', '')::UUID, v_qty, v_stock_reserved)
    RETURNING id INTO v_reservation_item_id;
    INSERT INTO inventory_movements(
      order_id, reservation_id, product_id, variant_id, movement_type,
      quantity_delta, idempotency_key, metadata
    ) VALUES (
      v_order_id, v_reservation_id, v_product.id, NULLIF(v_item->>'variant_id', '')::UUID,
      'reserved', -CASE WHEN v_stock_reserved THEN v_qty ELSE 0 END,
      'reservation:' || v_reservation_id || ':item:' || v_reservation_item_id || ':reserved',
      jsonb_build_object('stock_reserved', v_stock_reserved)
    );
  END LOOP;

  INSERT INTO order_items(order_id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd)
  SELECT v_order_id, pr.id, pv.id, pr.title_fr, pr.price_dzd + COALESCE(pv.price_delta_dzd, 0),
    (item->>'qty')::INTEGER,
    (pr.price_dzd + COALESCE(pv.price_delta_dzd, 0)) * (item->>'qty')::INTEGER
  FROM jsonb_array_elements(p_items) item
  JOIN products pr ON pr.id = (item->>'product_id')::UUID
  LEFT JOIN product_variants pv ON pv.id = NULLIF(item->>'variant_id', '')::UUID AND pv.product_id = pr.id;

  INSERT INTO payments(order_id, method, provider, status, amount_dzd, idempotency_key)
  VALUES (v_order_id, v_method, NULL, 'pending', v_total, 'checkout:' || p_checkout_key)
  RETURNING id INTO v_payment_id;
  INSERT INTO payment_events(payment_id, event_type, actor_type, metadata)
  VALUES (v_payment_id, 'payment_created', 'customer',
    jsonb_build_object('amount_dzd', v_total, 'method', v_method, 'reservation_id', v_reservation_id));

  RETURN QUERY SELECT v_order_id, v_payment_id, p_order_number;
END;
$$;

CREATE OR REPLACE FUNCTION admin_transition_payment_atomic(
  p_payment_id UUID,
  p_target_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_actor_id TEXT DEFAULT 'admin'
)
RETURNS payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment payments;
  v_event_type TEXT;
  v_clean_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF p_target_status NOT IN ('paid', 'rejected') THEN RAISE EXCEPTION 'INVALID_PAYMENT_TRANSITION'; END IF;
  IF p_target_status = 'rejected' AND v_clean_note IS NULL THEN RAISE EXCEPTION 'REJECTION_REASON_REQUIRED'; END IF;

  UPDATE payments
  SET status = p_target_status,
      verified_at = CASE WHEN p_target_status = 'paid' THEN now() ELSE verified_at END,
      verified_by = p_actor_id,
      verification_note = CASE WHEN p_target_status = 'paid' THEN v_clean_note ELSE verification_note END,
      failure_reason = CASE WHEN p_target_status = 'rejected' THEN v_clean_note ELSE failure_reason END
  WHERE id = p_payment_id AND status IN ('pending', 'verification_required')
  RETURNING * INTO v_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_STATE_CONFLICT'; END IF;

  IF p_target_status = 'paid' THEN
    PERFORM consume_inventory_reservation(v_payment.order_id);
  ELSE
    PERFORM release_inventory_reservation_for_order(v_payment.order_id);
  END IF;

  v_event_type := CASE WHEN p_target_status = 'paid' THEN 'payment_verified' ELSE 'payment_rejected' END;
  INSERT INTO payment_events(payment_id, event_type, actor_type, actor_id, metadata)
  VALUES (v_payment.id, v_event_type, 'admin', p_actor_id, jsonb_build_object('note', v_clean_note));
  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION create_order_payment_atomic(TEXT, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_order_payment_atomic(TEXT, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER, TEXT, JSONB, JSONB) TO service_role;
REVOKE ALL ON FUNCTION admin_transition_payment_atomic(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_transition_payment_atomic(UUID, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION release_inventory_reservation(UUID, TEXT), release_inventory_reservation_for_order(UUID), release_expired_inventory_reservations(), consume_inventory_reservation(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION release_inventory_reservation(UUID, TEXT), release_inventory_reservation_for_order(UUID), release_expired_inventory_reservations(), consume_inventory_reservation(UUID) TO service_role;
