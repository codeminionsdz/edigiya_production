-- Keep the Phase 1 reservation active while a paid digital order is being
-- allocated. Consume it only after digital allocation succeeds.

CREATE OR REPLACE FUNCTION public.admin_transition_payment_atomic(
  p_payment_id UUID,
  p_target_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_actor_id TEXT DEFAULT 'admin'
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments;
  v_clean_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_is_digital_inventory BOOLEAN := FALSE;
BEGIN
  IF p_target_status NOT IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_TRANSITION';
  END IF;
  IF p_target_status = 'rejected' AND v_clean_note IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;

  UPDATE public.payments
  SET status = p_target_status,
      verified_at = CASE WHEN p_target_status = 'paid' THEN now() ELSE verified_at END,
      verified_by = p_actor_id,
      verification_note = CASE WHEN p_target_status = 'paid' THEN v_clean_note ELSE verification_note END,
      failure_reason = CASE WHEN p_target_status = 'rejected' THEN v_clean_note ELSE failure_reason END
  WHERE id = p_payment_id AND status IN ('pending', 'verification_required')
  RETURNING * INTO v_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_STATE_CONFLICT'; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.orders AS o
    JOIN public.order_items AS oi ON oi.order_id = o.id
    JOIN public.products AS pr ON pr.id = oi.product_id
    WHERE o.id = v_payment.order_id
      AND o.delivery_method = 'digital'
      AND pr.fulfillment_type IN ('credentials', 'code')
  ) INTO v_is_digital_inventory;

  IF p_target_status = 'paid' THEN
    -- Digital allocation needs the Phase 1 reservation to remain active.
    -- The orchestration RPC consumes it after allocation succeeds.
    IF NOT v_is_digital_inventory THEN
      PERFORM public.consume_inventory_reservation(v_payment.order_id);
    END IF;
  ELSE
    PERFORM public.release_inventory_reservation_for_order(v_payment.order_id);
  END IF;

  INSERT INTO public.payment_events(payment_id, event_type, actor_type, actor_id, metadata)
  VALUES (
    v_payment.id,
    CASE WHEN p_target_status = 'paid' THEN 'payment_verified' ELSE 'payment_rejected' END,
    'admin', p_actor_id, jsonb_build_object('note', v_clean_note)
  );
  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.orchestrate_digital_fulfillment(
  p_order_id UUID,
  p_actor_id TEXT DEFAULT 'admin'
)
RETURNS public.order_fulfillments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_payment RECORD;
  v_fulfillment public.order_fulfillments;
  v_item RECORD;
  v_reservation RECORD;
  v_reserved RECORD;
  v_allocation RECORD;
  v_current_version RECORD;
  v_allocation_count INTEGER;
  v_key TEXT;
  v_digital_item_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'INVALID_DIGITAL_FULFILLMENT_ORDER'; END IF;

  SELECT o.id, o.delivery_method, o.status, o.session_id INTO v_order
  FROM public.orders AS o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE';
  END IF;

  SELECT p.id, p.status INTO v_payment
  FROM public.payments AS p
  WHERE p.order_id = p_order_id
  ORDER BY p.created_at DESC, p.id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_payment.status <> 'paid' THEN RAISE EXCEPTION 'PAYMENT_NOT_PAID'; END IF;

  SELECT f.* INTO v_fulfillment
  FROM public.order_fulfillments AS f
  WHERE f.order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.order_fulfillments(order_id, fulfillment_type, status)
    VALUES (p_order_id, 'manual', 'pending') RETURNING * INTO v_fulfillment;
  ELSIF v_fulfillment.status IN ('delivered', 'cancelled', 'failed') THEN
    RAISE EXCEPTION 'FULFILLMENT_STATE_CONFLICT';
  END IF;

  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.variant_id, oi.qty, pr.fulfillment_type
    FROM public.order_items AS oi
    JOIN public.products AS pr ON pr.id = oi.product_id
    WHERE oi.order_id = p_order_id ORDER BY oi.id FOR UPDATE OF oi
  LOOP
    IF v_item.fulfillment_type NOT IN ('credentials', 'code') THEN CONTINUE; END IF;
    v_digital_item_count := v_digital_item_count + 1;

    SELECT r.id, r.status, r.expires_at INTO v_reservation
    FROM public.inventory_reservations AS r
    WHERE r.order_id = p_order_id FOR UPDATE;
    IF NOT FOUND OR v_reservation.status <> 'active' OR v_reservation.expires_at <= now() THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_NOT_FOUND';
    END IF;

    SELECT count(*) INTO v_allocation_count
    FROM public.digital_fulfillment_allocations AS dfa
    WHERE dfa.fulfillment_id = v_fulfillment.id AND dfa.order_item_id = v_item.id;
    IF v_allocation_count = v_item.qty THEN CONTINUE;
    ELSIF v_allocation_count <> 0 THEN RAISE EXCEPTION 'DIGITAL_FULFILLMENT_PARTIAL_ALLOCATION'; END IF;

    v_key := 'fulfillment:unit-reservation:' || p_order_id::TEXT || ':' || v_item.id::TEXT;
    FOR v_reserved IN
      SELECT * FROM public.reserve_digital_units_for_reservation(
        p_order_id, v_item.id, v_reservation.id, v_key
      ) ORDER BY reservation_slot
    LOOP
      v_key := 'fulfillment:unit-allocation:' || p_order_id::TEXT || ':' || v_item.id::TEXT || ':' || v_reserved.reservation_slot::TEXT;
      SELECT * INTO v_allocation FROM public.allocate_digital_unit(
        p_order_id, v_item.id, v_reservation.id, v_reserved.reservation_slot, v_key
      );
      IF v_allocation.allocation_status <> 'allocated' THEN RAISE EXCEPTION 'DIGITAL_UNIT_ALLOCATION_NOT_READY'; END IF;

      SELECT sv.id, sv.version_no INTO v_current_version
      FROM public.digital_unit_secret_versions AS sv
      JOIN public.digital_inventory_units AS u
        ON u.id = sv.digital_inventory_unit_id
       AND u.vault_secret_id = sv.vault_secret_id
       AND u.secret_version = sv.version_no
       AND u.status IN ('allocated', 'consumed')
      WHERE sv.digital_inventory_unit_id = v_allocation.digital_inventory_unit_id
        AND sv.status = 'current';
      IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_SECRET_VERSION_UNAVAILABLE'; END IF;

      INSERT INTO public.digital_fulfillment_allocations(
        fulfillment_id, allocation_id, order_id, order_item_id,
        product_id, variant_id, allocation_slot, status
      ) VALUES (
        v_fulfillment.id, v_allocation.allocation_id, p_order_id, v_item.id,
        v_item.product_id, v_item.variant_id, v_reserved.reservation_slot, 'ready'
      );
    END LOOP;
  END LOOP;

  IF v_digital_item_count = 0 THEN RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE'; END IF;

  -- The Phase 1 reservation is consumed only after every digital allocation
  -- and secret-version check succeeds. Any failure rolls back the transaction.
  PERFORM public.consume_inventory_reservation(p_order_id);

  UPDATE public.order_fulfillments
  SET status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END
  WHERE id = v_fulfillment.id RETURNING * INTO v_fulfillment;

  IF NOT EXISTS (
    SELECT 1 FROM public.fulfillment_events AS fe
    WHERE fe.fulfillment_id = v_fulfillment.id
      AND fe.event_type = 'fulfillment_processing'
      AND fe.metadata->>'operation' = 'digital_orchestration'
  ) THEN
    INSERT INTO public.fulfillment_events(fulfillment_id, event_type, actor_type, actor_id, metadata)
    VALUES (v_fulfillment.id, 'fulfillment_processing', 'admin', NULLIF(btrim(p_actor_id), ''),
            jsonb_build_object('operation', 'digital_orchestration'));
  END IF;
  RETURN v_fulfillment;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_transition_payment_atomic(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_payment_atomic(UUID, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.orchestrate_digital_fulfillment(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orchestrate_digital_fulfillment(UUID, TEXT) TO service_role;
