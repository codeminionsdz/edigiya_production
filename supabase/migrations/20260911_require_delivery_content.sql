-- Explicit delivery requires content. Manual content is represented by its message.
CREATE OR REPLACE FUNCTION admin_prepare_order_fulfillment(p_order_id UUID)
RETURNS order_fulfillments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_fulfillment order_fulfillments;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id = p_order_id AND o.delivery_method = 'digital' AND p.status = 'paid') THEN
    RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE';
  END IF;
  INSERT INTO order_fulfillments(order_id, fulfillment_type, status) VALUES (p_order_id, 'manual', 'pending') ON CONFLICT (order_id) DO NOTHING;
  SELECT * INTO v_fulfillment FROM order_fulfillments WHERE order_id = p_order_id;
  RETURN v_fulfillment;
END;
$$;
REVOKE ALL ON FUNCTION admin_prepare_order_fulfillment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_prepare_order_fulfillment(UUID) TO service_role;

CREATE OR REPLACE FUNCTION admin_deliver_order_atomic(p_order_id UUID, p_actor_id TEXT DEFAULT NULL)
RETURNS order_fulfillments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_fulfillment order_fulfillments;
BEGIN
  SELECT f.* INTO v_fulfillment
  FROM order_fulfillments f
  JOIN orders o ON o.id = f.order_id
  WHERE f.order_id = p_order_id AND o.delivery_method = 'digital'
    AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'paid')
    AND EXISTS (SELECT 1 FROM fulfillment_items i WHERE i.fulfillment_id = f.id);

  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE'; END IF;

  UPDATE order_fulfillments SET status = 'delivered', delivered_at = NOW()
  WHERE id = v_fulfillment.id AND status IN ('pending', 'processing')
  RETURNING * INTO v_fulfillment;
  IF NOT FOUND THEN RAISE EXCEPTION 'FULFILLMENT_STATE_CONFLICT'; END IF;

  INSERT INTO fulfillment_events(fulfillment_id, event_type, actor_type, actor_id, metadata)
  VALUES (v_fulfillment.id, 'fulfillment_delivered', 'admin', NULLIF(btrim(p_actor_id), ''), '{}'::jsonb);
  RETURN v_fulfillment;
END;
$$;

REVOKE ALL ON FUNCTION admin_deliver_order_atomic(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_deliver_order_atomic(UUID, TEXT) TO service_role;
