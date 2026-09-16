-- Canonical boundary for admin verification of automatic digital orders.
-- The existing allocation, fulfillment, Vault-boundary, and outbox primitives
-- remain the implementation details; this function makes their business flow
-- one transaction and one idempotent server-side entry point.
CREATE OR REPLACE FUNCTION public.confirm_payment_and_deliver_digital_order_atomic(
  p_payment_id UUID,
  p_idempotency_key TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  already_processed BOOLEAN,
  order_id UUID,
  payment_id UUID,
  fulfillment_id UUID,
  allocation_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_payment public.payments;
  v_fulfillment public.order_fulfillments;
  v_allocation RECORD;
  v_digital_item_count INTEGER;
  v_allocation_count INTEGER;
BEGIN
  IF p_payment_id IS NULL
     OR p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_DELIVERY_INPUT';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders AS o
  JOIN public.payments AS p ON p.order_id = o.id
  WHERE p.id = p_payment_id
  FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_ORDER_NOT_FOUND'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.order_id IS DISTINCT FROM v_order.id THEN RAISE EXCEPTION 'PAYMENT_ORDER_MISMATCH'; END IF;
  IF v_payment.method NOT IN ('flexy', 'ccp', 'bank_transfer', 'cod', 'bank') THEN
    RAISE EXCEPTION 'MANUAL_PAYMENT_NOT_ELIGIBLE';
  END IF;
  IF v_payment.amount_dzd IS DISTINCT FROM v_order.total_dzd THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH';
  END IF;
  IF v_order.delivery_method <> 'digital' THEN RAISE EXCEPTION 'DIGITAL_ORDER_REQUIRED'; END IF;

  SELECT count(*) INTO v_digital_item_count
  FROM public.order_items AS oi
  JOIN public.products AS pr ON pr.id = oi.product_id
  WHERE oi.order_id = v_order.id
    AND pr.fulfillment_type IN ('credentials', 'code')
    AND oi.qty > 0;
  IF v_digital_item_count = 0 THEN RAISE EXCEPTION 'DIGITAL_ORDER_ITEM_REQUIRED'; END IF;

  -- A completed order is a safe retry result, but only when the invariant is
  -- intact. A delivered fulfillment without an allocation must never pass.
  SELECT f.* INTO v_fulfillment
  FROM public.order_fulfillments AS f
  WHERE f.order_id = v_order.id
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT 1
  FOR UPDATE;
  IF v_payment.status = 'paid' AND v_fulfillment.status = 'delivered' THEN
    SELECT dfa.* INTO v_allocation
    FROM public.digital_fulfillment_allocations AS dfa
    WHERE dfa.fulfillment_id = v_fulfillment.id
      AND dfa.order_id = v_order.id
      AND dfa.status = 'delivered'
    ORDER BY dfa.created_at, dfa.id
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_DELIVERY_INVARIANT_BROKEN'; END IF;
    PERFORM public.enqueue_digital_delivery_emails_for_fulfillment(v_fulfillment.id);
    RETURN QUERY SELECT TRUE, TRUE, v_order.id, v_payment.id, v_fulfillment.id, v_allocation.allocation_id;
    RETURN;
  END IF;

  IF v_payment.status IN ('rejected', 'cancelled', 'failed') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_VERIFIABLE';
  END IF;

  IF v_payment.status IN ('pending', 'verification_required') THEN
    SELECT * INTO v_payment
    FROM public.admin_transition_payment_atomic(
      p_payment_id, 'paid', p_note, 'admin'
    );
  ELSIF v_payment.status <> 'paid' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_VERIFIABLE';
  END IF;

  -- Refreshes only the existing reservation when necessary; it does not make
  -- a second reservation or introduce another inventory subsystem.
  PERFORM public.refresh_digital_reservation_for_paid_order(v_order.id);
  SELECT * INTO v_fulfillment
  FROM public.orchestrate_digital_fulfillment(v_order.id, 'admin');
  SELECT * INTO v_fulfillment
  FROM public.admin_deliver_order_atomic(v_order.id, 'admin');

  SELECT count(*) INTO v_allocation_count
  FROM public.digital_fulfillment_allocations AS dfa
  WHERE dfa.fulfillment_id = v_fulfillment.id
    AND dfa.status = 'delivered';
  IF v_allocation_count = 0 THEN RAISE EXCEPTION 'DIGITAL_DELIVERY_ALLOCATION_REQUIRED'; END IF;

  SELECT dfa.* INTO v_allocation
  FROM public.digital_fulfillment_allocations AS dfa
  WHERE dfa.fulfillment_id = v_fulfillment.id AND dfa.status = 'delivered'
  ORDER BY dfa.created_at, dfa.id LIMIT 1;
  RETURN QUERY SELECT TRUE, FALSE, v_order.id, v_payment.id, v_fulfillment.id, v_allocation.allocation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment_and_deliver_digital_order_atomic(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_and_deliver_digital_order_atomic(UUID, TEXT, TEXT)
  TO service_role;
