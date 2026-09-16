-- Phase 2: enqueue digital delivery email jobs from the authoritative
-- fulfillment-delivered transition. No external network call is made here.

CREATE OR REPLACE FUNCTION public.enqueue_digital_delivery_emails_for_fulfillment(
  p_fulfillment_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fulfillment RECORD;
  v_item RECORD;
  v_count INTEGER := 0;
BEGIN
  IF p_fulfillment_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_EMAIL_FULFILLMENT';
  END IF;

  SELECT f.id, f.order_id, f.status, o.delivery_method
    INTO v_fulfillment
  FROM public.order_fulfillments AS f
  JOIN public.orders AS o ON o.id = f.order_id
  WHERE f.id = p_fulfillment_id
  FOR UPDATE;

  IF NOT FOUND OR v_fulfillment.status <> 'delivered'
     OR v_fulfillment.delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_FULFILLMENT_NOT_READY';
  END IF;

  FOR v_item IN
    SELECT DISTINCT dfa.order_item_id
    FROM public.digital_fulfillment_allocations AS dfa
    WHERE dfa.fulfillment_id = p_fulfillment_id
      AND dfa.status = 'delivered'
    ORDER BY dfa.order_item_id
  LOOP
    PERFORM public.enqueue_digital_delivery_email(
      v_fulfillment.order_id,
      v_item.order_item_id,
      CASE WHEN EXISTS (
        SELECT 1
        FROM public.customer_profiles AS cp
        JOIN public.orders AS o ON o.session_id = cp.session_id
        WHERE o.id = v_fulfillment.order_id
          AND cp.password_hash IS NOT NULL
          AND cp.password_salt IS NOT NULL
      ) THEN 'account_digital_delivery' ELSE 'guest_digital_delivery' END,
      'fulfillment-delivered:' || v_fulfillment.order_id::TEXT || ':' || v_item.order_item_id::TEXT
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Replace the existing trusted transition with the same behavior plus the
-- durable outbox enqueue. The outbox call is transactional and idempotent;
-- no provider/network operation occurs inside this function.
CREATE OR REPLACE FUNCTION public.admin_deliver_order_atomic(
  p_order_id UUID,
  p_actor_id TEXT DEFAULT NULL
)
RETURNS public.order_fulfillments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fulfillment public.order_fulfillments;
BEGIN
  SELECT f.* INTO v_fulfillment
  FROM public.order_fulfillments AS f
  JOIN public.orders AS o ON o.id = f.order_id
  WHERE f.order_id = p_order_id
    AND o.delivery_method = 'digital'
    AND EXISTS (
      SELECT 1 FROM public.payments AS p
      WHERE p.order_id = o.id AND p.status = 'paid'
    )
    AND (
      EXISTS (SELECT 1 FROM public.fulfillment_items AS i WHERE i.fulfillment_id = f.id)
      OR EXISTS (
        SELECT 1
        FROM public.digital_fulfillment_allocations AS dfa
        WHERE dfa.fulfillment_id = f.id AND dfa.status = 'ready'
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE';
  END IF;

  UPDATE public.order_fulfillments
  SET status = 'delivered', delivered_at = now()
  WHERE id = v_fulfillment.id AND status IN ('pending', 'processing')
  RETURNING * INTO v_fulfillment;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FULFILLMENT_STATE_CONFLICT';
  END IF;

  UPDATE public.digital_fulfillment_allocations
  SET status = 'delivered'
  WHERE fulfillment_id = v_fulfillment.id AND status = 'ready';

  INSERT INTO public.fulfillment_events(
    fulfillment_id, event_type, actor_type, actor_id, metadata
  ) VALUES (
    v_fulfillment.id, 'fulfillment_delivered', 'admin',
    NULLIF(btrim(p_actor_id), ''), '{}'::jsonb
  );

  -- Only allocation-backed items are enqueued here. Legacy fulfillment_items
  -- remains compatible and is not converted into the new email path.
  PERFORM public.enqueue_digital_delivery_emails_for_fulfillment(v_fulfillment.id);

  RETURN v_fulfillment;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_digital_delivery_emails_for_fulfillment(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_digital_delivery_emails_for_fulfillment(UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.admin_deliver_order_atomic(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deliver_order_atomic(UUID, TEXT)
  TO service_role;
