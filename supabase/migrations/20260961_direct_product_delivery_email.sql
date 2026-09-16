-- Queue the delivery email for the product-only fulfillment path.
-- It deliberately uses sold inventory units and does not use allocations/variants.
CREATE OR REPLACE FUNCTION public.enqueue_direct_product_delivery_email(
  p_order_id UUID,
  p_order_item_id UUID,
  p_idempotency_key TEXT
)
RETURNS TABLE(outbox_id UUID, outbox_status TEXT, recipient_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_existing public.digital_email_outbox%ROWTYPE;
  v_email TEXT;
  v_type TEXT;
BEGIN
  SELECT o.id, o.session_id, o.delivery_method, o.address_snapshot
    INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_ORDER_NOT_ELIGIBLE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payments AS p
    WHERE p.order_id = p_order_id AND p.status = 'paid'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.order_fulfillments AS f
    WHERE f.order_id = p_order_id AND f.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_DELIVERY_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.order_items AS oi
    JOIN public.digital_inventory_units AS u
      ON u.order_item_id = oi.id AND u.status = 'sold'
    WHERE oi.id = p_order_item_id AND oi.order_id = p_order_id
  ) THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_ITEM_NOT_DELIVERED';
  END IF;

  v_email := lower(btrim(v_order.address_snapshot->>'email'));
  IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_RECIPIENT_INVALID';
  END IF;
  v_type := CASE WHEN EXISTS (
    SELECT 1 FROM public.customer_profiles AS cp
    WHERE cp.session_id = v_order.session_id
      AND cp.password_hash IS NOT NULL AND cp.password_salt IS NOT NULL
  ) THEN 'account_digital_delivery' ELSE 'guest_digital_delivery' END;

  SELECT e.* INTO v_existing
  FROM public.digital_email_outbox AS e
  WHERE e.idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.status, v_existing.recipient_email;
    RETURN;
  END IF;

  INSERT INTO public.digital_email_outbox AS e(
    order_id, order_item_id, recipient_email, email_type, payload, idempotency_key
  ) VALUES (
    p_order_id, p_order_item_id, v_email, v_type,
    jsonb_build_object('delivery_mode', v_type, 'order_id', p_order_id,
      'order_item_id', p_order_item_id),
    p_idempotency_key
  )
  RETURNING e.id, e.status, e.recipient_email
  INTO outbox_id, outbox_status, recipient_email;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_direct_product_delivery_email(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_direct_product_delivery_email(UUID, UUID, TEXT)
  TO service_role;

-- Compatibility overload for an older deployed server build. It queues the
-- whole order; the email context reads all delivered product units.
CREATE OR REPLACE FUNCTION public.enqueue_direct_product_delivery_email(
  p_order_id UUID,
  p_idempotency_key TEXT
)
RETURNS TABLE(outbox_id UUID, outbox_status TEXT, recipient_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_email TEXT;
  v_type TEXT;
BEGIN
  SELECT o.id, o.session_id, o.delivery_method, o.address_snapshot
    INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;
  IF NOT FOUND OR v_order.delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_ORDER_NOT_ELIGIBLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payments AS p WHERE p.order_id = p_order_id AND p.status = 'paid')
     OR NOT EXISTS (SELECT 1 FROM public.order_fulfillments AS f WHERE f.order_id = p_order_id AND f.status = 'delivered')
     OR NOT EXISTS (SELECT 1 FROM public.digital_inventory_units AS u JOIN public.order_items AS oi ON oi.id = u.order_item_id WHERE oi.order_id = p_order_id AND u.status = 'sold') THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_DELIVERY_NOT_READY';
  END IF;
  v_email := lower(btrim(v_order.address_snapshot->>'email'));
  IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_RECIPIENT_INVALID';
  END IF;
  v_type := CASE WHEN EXISTS (
    SELECT 1 FROM public.customer_profiles AS cp
    WHERE cp.session_id = v_order.session_id AND cp.password_hash IS NOT NULL AND cp.password_salt IS NOT NULL
  ) THEN 'account_digital_delivery' ELSE 'guest_digital_delivery' END;
  INSERT INTO public.digital_email_outbox AS e(order_id, order_item_id, recipient_email, email_type, payload, idempotency_key)
  VALUES (p_order_id, NULL, v_email, v_type,
    jsonb_build_object('delivery_mode', v_type, 'order_id', p_order_id), p_idempotency_key)
  ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
  RETURNING e.id, e.status, e.recipient_email INTO outbox_id, outbox_status, recipient_email;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_direct_product_delivery_email(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_direct_product_delivery_email(UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
