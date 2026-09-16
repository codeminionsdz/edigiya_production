-- Product-only delivery path. It intentionally bypasses legacy reservation and
-- fulfillment orchestration tables for direct digital inventory products.
CREATE OR REPLACE FUNCTION public.deliver_paid_product_units(
  p_order_id UUID,
  p_actor_id TEXT DEFAULT 'admin'
)
RETURNS TABLE(delivered_units INTEGER, delivery_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_status TEXT;
  v_delivery_method TEXT;
  v_order_item RECORD;
  v_unit RECORD;
  v_required INTEGER;
  v_delivered INTEGER := 0;
  v_delivery_id UUID;
  v_access_type TEXT;
  v_email TEXT;
  v_email_type TEXT;
BEGIN
  SELECT p.status, o.delivery_method
  INTO v_payment_status, v_delivery_method
  FROM public.orders AS o
  JOIN public.payments AS p ON p.order_id = o.id
  WHERE o.id = p_order_id AND p.status = 'paid'
  ORDER BY p.created_at DESC
  LIMIT 1;
  IF v_payment_status IS NULL OR v_delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE';
  END IF;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.customer_profiles AS cp
    JOIN public.orders AS o ON o.session_id = cp.session_id
    WHERE o.id = p_order_id AND cp.email IS NOT NULL
  ) THEN 'account' ELSE 'guest' END
  INTO v_access_type;

  FOR v_order_item IN
    SELECT oi.id, oi.product_id, oi.qty
    FROM public.order_items AS oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.id
  LOOP
    FOR v_required IN 1..v_order_item.qty LOOP
      SELECT u.id
      INTO v_unit
      FROM public.digital_inventory_units AS u
      WHERE u.product_id = v_order_item.product_id
        AND u.status = 'available'
        AND u.vault_secret_id IS NOT NULL
      ORDER BY u.created_at, u.id
      FOR UPDATE SKIP LOCKED
      LIMIT 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE';
      END IF;

      UPDATE public.digital_inventory_units AS u
      SET status = 'sold', order_item_id = v_order_item.id,
          sold_at = now(), updated_by = p_actor_id, updated_at = now()
      WHERE u.id = v_unit.id AND u.status = 'available';
      IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE'; END IF;
      v_delivered := v_delivered + 1;
    END LOOP;

    INSERT INTO public.digital_access(order_id, order_item_id, session_id, access_type)
    SELECT p_order_id, v_order_item.id, o.session_id, v_access_type
    FROM public.orders AS o WHERE o.id = p_order_id
    ON CONFLICT (order_item_id) DO NOTHING;
  END LOOP;

  INSERT INTO public.digital_deliveries(order_id, status, delivered_at)
  VALUES (p_order_id, 'delivered', now())
  ON CONFLICT (order_id) DO UPDATE
    SET status = 'delivered', delivered_at = COALESCE(public.digital_deliveries.delivered_at, now())
  RETURNING id INTO v_delivery_id;

  INSERT INTO public.order_fulfillments(order_id, fulfillment_type, status, delivered_at)
  VALUES (p_order_id, 'manual', 'delivered', now())
  ON CONFLICT (order_id) DO UPDATE
    SET status = 'delivered', delivered_at = COALESCE(public.order_fulfillments.delivered_at, now());

  SELECT COALESCE(cp.email, o.address_snapshot->>'email')
  INTO v_email
  FROM public.orders AS o
  LEFT JOIN public.customer_profiles AS cp ON cp.session_id = o.session_id
  WHERE o.id = p_order_id
  LIMIT 1;
  IF v_email IS NOT NULL AND length(btrim(v_email)) > 0 THEN
    v_email_type := CASE WHEN v_access_type = 'account'
      THEN 'account_digital_delivery' ELSE 'guest_digital_delivery' END;
    INSERT INTO public.digital_email_outbox(
      order_id, order_item_id, recipient_email, email_type, payload, idempotency_key
    ) VALUES (
      p_order_id, NULL, v_email, v_email_type, '{}'::jsonb,
      'simple-product-delivery:' || p_order_id::TEXT
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_delivered, v_delivery_id;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_paid_product_units(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_paid_product_units(UUID, TEXT) TO service_role;
