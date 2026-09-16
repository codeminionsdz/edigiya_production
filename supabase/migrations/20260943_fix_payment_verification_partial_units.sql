-- Confirm manual payment even when the requested digital quantity is not fully in stock.
-- Available units are delivered immediately; missing units are recorded for admin follow-up.

CREATE OR REPLACE FUNCTION public.confirm_payment_and_deliver_digital_order(
  p_order_id UUID,
  p_payment_id UUID,
  p_idempotency_key TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  already_processed BOOLEAN,
  order_id UUID,
  payment_id UUID,
  delivery_id UUID,
  units_assigned INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_delivery public.digital_deliveries%ROWTYPE;
  v_item RECORD;
  v_unit RECORD;
  v_required INTEGER;
  v_assigned INTEGER := 0;
  v_missing INTEGER := 0;
  v_email TEXT;
  v_email_type TEXT;
  v_note TEXT;
BEGIN
  IF p_order_id IS NULL OR p_payment_id IS NULL OR p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0 OR length(p_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_DELIVERY_INPUT';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.order_id IS DISTINCT FROM v_order.id THEN
    RAISE EXCEPTION 'PAYMENT_ORDER_MISMATCH';
  END IF;
  IF v_payment.amount_dzd IS DISTINCT FROM v_order.total_dzd THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH';
  END IF;
  IF v_order.delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_ORDER_REQUIRED';
  END IF;

  SELECT * INTO v_delivery FROM public.digital_deliveries
  WHERE public.digital_deliveries.order_id = v_order.id FOR UPDATE;

  IF v_payment.status = 'paid' AND v_delivery.status = 'delivered' THEN
    SELECT count(*)::INTEGER INTO v_assigned
    FROM public.digital_inventory_units AS u
    JOIN public.order_items AS oi ON oi.id = u.order_item_id
    WHERE oi.order_id = v_order.id AND u.status = 'sold';
    RETURN QUERY SELECT TRUE, TRUE, v_order.id, v_payment.id, v_delivery.id, v_assigned;
    RETURN;
  END IF;

  IF v_payment.status IN ('rejected', 'cancelled', 'failed') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_VERIFIABLE';
  END IF;

  IF v_payment.status IN ('pending', 'verification_required') THEN
    UPDATE public.payments
    SET status = 'paid', verified_at = now(), verified_by = 'admin',
        verification_note = NULLIF(btrim(p_note), '')
    WHERE id = v_payment.id AND status IN ('pending', 'verification_required')
    RETURNING * INTO v_payment;
    IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_STATE_CONFLICT'; END IF;

    INSERT INTO public.payment_events(payment_id, event_type, actor_type, actor_id, metadata)
    VALUES (v_payment.id, 'payment_verified', 'admin', 'admin',
            jsonb_build_object('idempotency_key', p_idempotency_key));
  ELSIF v_payment.status <> 'paid' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_VERIFIABLE';
  END IF;

  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.variant_id, oi.qty
    FROM public.order_items AS oi
    JOIN public.products AS p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id AND p.fulfillment_type IN ('credentials', 'code')
    ORDER BY oi.created_at, oi.id
  LOOP
    FOR v_required IN 1..v_item.qty LOOP
      SELECT u.id INTO v_unit
      FROM public.digital_inventory_units AS u
      WHERE u.product_id = v_item.product_id
        AND u.variant_id IS NOT DISTINCT FROM v_item.variant_id
        AND u.status = 'available' AND u.vault_secret_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.digital_unit_secret_versions AS sv
          WHERE sv.digital_inventory_unit_id = u.id AND sv.status = 'current'
            AND sv.version_no = u.secret_version AND sv.vault_secret_id = u.vault_secret_id
        )
      ORDER BY u.created_at, u.id FOR UPDATE SKIP LOCKED LIMIT 1;

      IF NOT FOUND THEN
        v_missing := v_missing + 1;
        CONTINUE;
      END IF;

      UPDATE public.digital_inventory_units
      SET status = 'sold', order_item_id = v_item.id, sold_at = now(), updated_at = now()
      WHERE id = v_unit.id AND status = 'available';
      IF FOUND THEN v_assigned := v_assigned + 1; ELSE v_missing := v_missing + 1; END IF;
    END LOOP;

    IF EXISTS (
      SELECT 1 FROM public.digital_inventory_units
      WHERE order_item_id = v_item.id AND status = 'sold'
    ) THEN
      INSERT INTO public.digital_access(order_id, order_item_id, session_id, access_type)
      VALUES (v_order.id, v_item.id, v_order.session_id,
        CASE WHEN EXISTS (
          SELECT 1 FROM public.customer_profiles AS cp
          WHERE cp.session_id = v_order.session_id AND cp.email IS NOT NULL
        ) THEN 'account' ELSE 'guest' END)
      ON CONFLICT (order_item_id) DO NOTHING;
    END IF;
  END LOOP;

  IF v_missing > 0 THEN
    v_note := format('Stock insuffisant : %s unité(s) non disponible(s) pour cette commande.', v_missing);
    IF NULLIF(btrim(p_note), '') IS NOT NULL THEN v_note := btrim(p_note) || ' — ' || v_note; END IF;
    UPDATE public.orders SET admin_note = v_note WHERE id = v_order.id;
  END IF;

  IF v_assigned > 0 THEN
    INSERT INTO public.digital_deliveries(order_id, status, delivered_at)
    VALUES (v_order.id, 'delivered', now())
    ON CONFLICT (order_id) DO UPDATE SET status = 'delivered', delivered_at = COALESCE(public.digital_deliveries.delivered_at, now())
    RETURNING * INTO v_delivery;

    SELECT cp.email INTO v_email FROM public.customer_profiles AS cp WHERE cp.session_id = v_order.session_id LIMIT 1;
    v_email := COALESCE(v_email, v_order.address_snapshot->>'email');
    IF v_email IS NOT NULL AND length(btrim(v_email)) > 0 THEN
      v_email_type := CASE WHEN EXISTS (
        SELECT 1 FROM public.digital_access AS da WHERE da.order_id = v_order.id AND da.access_type = 'account'
      ) THEN 'account_digital_delivery' ELSE 'guest_digital_delivery' END;
      INSERT INTO public.digital_email_outbox(order_id, order_item_id, recipient_email, email_type, payload, idempotency_key)
      VALUES (v_order.id, NULL, v_email, v_email_type, '{}'::jsonb, 'clean-digital-delivery:' || v_order.id::TEXT)
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, FALSE, v_order.id, v_payment.id, v_delivery.id, v_assigned;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment_and_deliver_digital_order(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payment_and_deliver_digital_order(UUID, UUID, TEXT, TEXT) TO service_role;
