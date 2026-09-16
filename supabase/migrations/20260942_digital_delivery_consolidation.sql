-- Consolidate automatic Credentials/Code delivery onto the clean path.
-- Historical reservation/allocation/fulfillment objects remain intact for
-- compatibility, but are not used by this path.

ALTER TABLE public.digital_access
  ADD COLUMN IF NOT EXISTS guest_redeemed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_id_order_id_key'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_id_order_id_key UNIQUE (id, order_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'digital_access_order_item_order_fk'
      AND conrelid = 'public.digital_access'::regclass
  ) THEN
    ALTER TABLE public.digital_access
      ADD CONSTRAINT digital_access_order_item_order_fk
      FOREIGN KEY (order_item_id, order_id)
      REFERENCES public.order_items(id, order_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_clean_guest_access_token(
  p_order_id UUID, p_token TEXT, p_expires_at TIMESTAMPTZ, p_idempotency_key TEXT
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_hash TEXT; v_count INTEGER;
BEGIN
  IF p_order_id IS NULL OR p_token IS NULL OR length(p_token) < 32
     OR p_expires_at IS NULL OR p_expires_at <= now()
     OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_GUEST_ACCESS_INPUT';
  END IF;
  v_hash := encode(public.digest(p_token, 'sha256'), 'hex');
  UPDATE public.digital_access
  SET guest_token_hash = v_hash,
      guest_expires_at = p_expires_at,
      guest_redeemed_at = CASE
        WHEN guest_token_hash IS DISTINCT FROM v_hash THEN NULL
        ELSE guest_redeemed_at
      END
  WHERE order_id = p_order_id AND access_type = 'guest';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'GUEST_ACCESS_NOT_READY'; END IF;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_clean_guest_secret(p_token TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_hash TEXT; v_order_id UUID; v_order_item_id UUID; v_secret TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 OR length(p_token) > 512 THEN
    RAISE EXCEPTION 'DIGITAL_ACCESS_NOT_AUTHORIZED';
  END IF;
  v_hash := encode(public.digest(p_token, 'sha256'), 'hex');
  SELECT da.order_id, da.order_item_id INTO v_order_id, v_order_item_id
  FROM public.digital_access AS da
  WHERE da.guest_token_hash = v_hash
    AND da.guest_expires_at > now()
    AND da.guest_redeemed_at IS NULL
    AND da.access_type = 'guest'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_ACCESS_NOT_AUTHORIZED'; END IF;

  SELECT string_agg(ds.secret, E'\n\n' ORDER BY u.created_at, u.id) INTO v_secret
  FROM public.digital_deliveries AS d
  JOIN public.payments AS p ON p.order_id = d.order_id AND p.status = 'paid'
  JOIN public.digital_inventory_units AS u ON u.order_item_id = v_order_item_id AND u.status = 'sold'
  JOIN public.digital_unit_secret_versions AS sv
    ON sv.digital_inventory_unit_id = u.id AND sv.status = 'current'
   AND sv.version_no = u.secret_version AND sv.vault_secret_id = u.vault_secret_id
  JOIN vault.decrypted_secrets AS ds ON ds.id = sv.vault_secret_id
  WHERE d.order_id = v_order_id AND d.status = 'delivered';
  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE EXCEPTION 'DIGITAL_ACCESS_NOT_AUTHORIZED';
  END IF;

  UPDATE public.digital_access
  SET guest_redeemed_at = now(), last_accessed_at = now()
  WHERE order_id = v_order_id AND order_item_id = v_order_item_id
    AND guest_token_hash = v_hash AND guest_redeemed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_ACCESS_NOT_AUTHORIZED'; END IF;
  RETURN v_secret;
END;
$$;

-- SlickPay and manual verification converge on the same canonical operation.
CREATE OR REPLACE FUNCTION public.record_slickpay_verification_atomic(
  p_payment_id UUID, p_provider_invoice_id TEXT, p_completed BOOLEAN,
  p_provider_status TEXT, p_provider_amount NUMERIC
)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.orders%ROWTYPE; v_payment public.payments%ROWTYPE; v_has_automatic_items BOOLEAN;
BEGIN
  SELECT o.* INTO v_order FROM public.orders AS o
  JOIN public.payments AS p ON p.order_id = o.id
  WHERE p.id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SLICKPAY_PAYMENT_NOT_FOUND'; END IF;

  SELECT * INTO v_payment FROM public.payments
  WHERE id = p_payment_id AND method = 'slickpay' AND provider_reference = p_provider_invoice_id
  FOR UPDATE;
  IF NOT FOUND OR p_provider_amount IS NULL OR p_provider_amount <> v_payment.amount_dzd THEN
    RAISE EXCEPTION 'SLICKPAY_PAYMENT_MISMATCH';
  END IF;

  UPDATE public.payments SET
    provider_status = left(coalesce(p_provider_status, CASE WHEN p_completed THEN 'completed' ELSE 'pending' END), 100),
    provider_amount_dzd = p_provider_amount, provider_checked_at = now(),
    status = CASE WHEN p_completed AND status = 'pending' THEN 'paid' ELSE status END,
    verified_at = CASE WHEN p_completed AND status = 'pending' THEN now() ELSE verified_at END,
    verified_by = CASE WHEN p_completed AND status = 'pending' THEN 'slickpay' ELSE verified_by END
  WHERE id = v_payment.id RETURNING * INTO v_payment;

  IF p_completed AND NOT EXISTS (
    SELECT 1 FROM public.payment_events WHERE payment_id = v_payment.id
      AND event_type = 'payment_verified' AND actor_type = 'provider'
      AND metadata->>'provider_invoice_id' = p_provider_invoice_id
  ) THEN
    INSERT INTO public.payment_events(payment_id, event_type, actor_type, metadata)
    VALUES (v_payment.id, 'payment_verified', 'provider',
      jsonb_build_object('provider', 'slickpay', 'provider_invoice_id', p_provider_invoice_id, 'amount_dzd', p_provider_amount));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.order_items AS oi JOIN public.products AS p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id AND p.fulfillment_type IN ('credentials', 'code')
  ) INTO v_has_automatic_items;
  IF p_completed AND v_order.delivery_method = 'digital' AND v_has_automatic_items THEN
    PERFORM public.confirm_payment_and_deliver_digital_order(
      v_order.id, v_payment.id, 'slickpay:payment-verification:' || v_payment.id::TEXT, NULL
    );
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE id = v_payment.id;
  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.set_clean_guest_access_token(UUID, TEXT, TIMESTAMPTZ, TEXT),
  public.get_clean_guest_secret(TEXT),
  public.record_slickpay_verification_atomic(UUID, TEXT, BOOLEAN, TEXT, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_clean_guest_access_token(UUID, TEXT, TIMESTAMPTZ, TEXT),
  public.get_clean_guest_secret(TEXT),
  public.record_slickpay_verification_atomic(UUID, TEXT, BOOLEAN, TEXT, NUMERIC)
  TO service_role;
