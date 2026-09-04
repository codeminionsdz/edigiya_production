-- Digital fulfillment foundation. This is deliberately separate from payment and
-- legacy physical-order status; delivery never changes payment status.
CREATE TABLE IF NOT EXISTS order_fulfillments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  fulfillment_type TEXT NOT NULL DEFAULT 'manual' CHECK (fulfillment_type = 'manual'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fulfillment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fulfillment_id UUID NOT NULL REFERENCES order_fulfillments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('fulfillment_created', 'fulfillment_processing', 'fulfillment_delivered', 'fulfillment_failed', 'fulfillment_cancelled')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'system')),
  actor_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_events ENABLE ROW LEVEL SECURITY;

-- Access is intentionally through server-side, authenticated application code.
REVOKE ALL ON TABLE order_fulfillments, fulfillment_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE order_fulfillments, fulfillment_events TO service_role;

CREATE OR REPLACE FUNCTION admin_deliver_order_atomic(p_order_id UUID, p_actor_id TEXT DEFAULT NULL)
RETURNS order_fulfillments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fulfillment order_fulfillments;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM payments WHERE order_id = p_order_id AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'PAYMENT_NOT_PAID';
  END IF;

  INSERT INTO order_fulfillments(order_id, fulfillment_type, status)
  VALUES (p_order_id, 'manual', 'pending')
  ON CONFLICT (order_id) DO NOTHING;

  UPDATE order_fulfillments
  SET status = 'delivered', delivered_at = NOW()
  WHERE order_id = p_order_id AND status IN ('pending', 'processing')
  RETURNING * INTO v_fulfillment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FULFILLMENT_STATE_CONFLICT';
  END IF;

  INSERT INTO fulfillment_events(fulfillment_id, event_type, actor_type, actor_id, metadata)
  VALUES (v_fulfillment.id, 'fulfillment_delivered', 'admin', NULLIF(btrim(p_actor_id), ''), '{}'::jsonb);

  RETURN v_fulfillment;
END;
$$;

REVOKE ALL ON FUNCTION admin_deliver_order_atomic(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_deliver_order_atomic(UUID, TEXT) TO service_role;
