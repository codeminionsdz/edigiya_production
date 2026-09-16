-- Edigiya clean digital-delivery path.
--
-- This migration is additive. Historical reservation/allocation/fulfillment
-- tables remain available for legacy data, but the new automatic credential
-- and code flow uses only:
--   order -> payment -> inventory unit -> digital delivery -> digital access

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.digital_inventory_units
  ADD COLUMN IF NOT EXISTS order_item_id UUID
    REFERENCES public.order_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

-- Keep old statuses readable for historical rows. New code only reads/writes
-- available, sold, disabled and revoked.
ALTER TABLE public.digital_inventory_units
  DROP CONSTRAINT IF EXISTS digital_inventory_units_status_check;
ALTER TABLE public.digital_inventory_units
  ADD CONSTRAINT digital_inventory_units_status_check
  CHECK (status IN ('available', 'sold', 'disabled', 'revoked', 'reserved', 'allocated', 'consumed'));

CREATE INDEX IF NOT EXISTS digital_inventory_units_clean_available_idx
  ON public.digital_inventory_units(product_id, variant_id, created_at, id)
  WHERE status = 'available';
CREATE INDEX IF NOT EXISTS digital_inventory_units_clean_order_item_idx
  ON public.digital_inventory_units(order_item_id)
  WHERE order_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.digital_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'failed')),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.digital_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE RESTRICT,
  session_id UUID,
  access_type TEXT NOT NULL CHECK (access_type IN ('account', 'guest')),
  guest_token_hash TEXT,
  guest_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  CONSTRAINT digital_access_order_item_order_check
    CHECK (order_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS digital_access_order_idx
  ON public.digital_access(order_id);
CREATE INDEX IF NOT EXISTS digital_access_session_idx
  ON public.digital_access(session_id)
  WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS digital_access_guest_token_idx
  ON public.digital_access(guest_token_hash)
  WHERE guest_token_hash IS NOT NULL;
ALTER TABLE public.digital_access
  DROP CONSTRAINT IF EXISTS digital_access_guest_token_hash_key;

ALTER TABLE public.digital_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.digital_deliveries, public.digital_access
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.digital_deliveries, public.digital_access TO service_role;

-- Backfill only relationships that are already proven by the old allocation
-- chain. Unresolved legacy rows are intentionally left untouched.
INSERT INTO public.digital_deliveries(order_id, status, delivered_at)
SELECT f.order_id, 'delivered', f.delivered_at
FROM public.order_fulfillments AS f
JOIN public.orders AS o ON o.id = f.order_id AND o.delivery_method = 'digital'
WHERE f.status = 'delivered'
  AND EXISTS (
    SELECT 1
    FROM public.digital_fulfillment_allocations AS dfa
    WHERE dfa.fulfillment_id = f.id AND dfa.status = 'delivered'
  )
ON CONFLICT (order_id) DO NOTHING;

UPDATE public.digital_inventory_units AS u
SET order_item_id = a.order_item_id,
    status = 'sold',
    sold_at = COALESCE(u.sold_at, f.delivered_at, now()),
    updated_at = now()
FROM public.digital_unit_allocations AS a
JOIN public.digital_fulfillment_allocations AS dfa
  ON dfa.allocation_id = a.id
 AND dfa.order_id = a.order_id
 AND dfa.order_item_id = a.order_item_id
JOIN public.order_fulfillments AS f
  ON f.id = dfa.fulfillment_id
 AND f.status = 'delivered'
WHERE u.id = a.digital_inventory_unit_id
  AND u.order_item_id IS NULL
  AND a.status IN ('allocated', 'consumed')
  AND dfa.status = 'delivered';

INSERT INTO public.digital_access(order_id, order_item_id, session_id, access_type)
SELECT DISTINCT oi.order_id,
       oi.id,
       o.session_id,
       CASE WHEN cp.email IS NULL THEN 'guest' ELSE 'account' END
FROM public.order_items AS oi
JOIN public.orders AS o ON o.id = oi.order_id
JOIN public.digital_deliveries AS d ON d.order_id = o.id AND d.status = 'delivered'
LEFT JOIN public.customer_profiles AS cp ON cp.session_id = o.session_id
WHERE EXISTS (
  SELECT 1 FROM public.digital_inventory_units AS u
  WHERE u.order_item_id = oi.id AND u.status = 'sold'
)
ON CONFLICT (order_item_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_digital_clean_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS digital_deliveries_updated_at ON public.digital_deliveries;
CREATE TRIGGER digital_deliveries_updated_at
BEFORE UPDATE ON public.digital_deliveries
FOR EACH ROW EXECUTE FUNCTION public.update_digital_clean_updated_at();

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
  v_email TEXT;
  v_email_type TEXT;
BEGIN
  IF p_order_id IS NULL OR p_payment_id IS NULL
     OR p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 255 THEN
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

  SELECT * INTO v_delivery
  FROM public.digital_deliveries
  WHERE order_id = v_order.id
  FOR UPDATE;

  IF v_payment.status = 'paid' AND v_delivery.status = 'delivered' THEN
    SELECT count(*)::INTEGER INTO v_assigned
    FROM public.digital_inventory_units AS u
    JOIN public.order_items AS oi ON oi.id = u.order_item_id
    WHERE oi.order_id = v_order.id AND u.status = 'sold';
    IF v_assigned = 0 THEN RAISE EXCEPTION 'DIGITAL_DELIVERY_INVARIANT_BROKEN'; END IF;
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

  SELECT COALESCE(sum(oi.qty), 0)::INTEGER INTO v_required
  FROM public.order_items AS oi
  JOIN public.products AS p ON p.id = oi.product_id
  WHERE oi.order_id = v_order.id
    AND p.fulfillment_type IN ('credentials', 'code');
  IF v_required = 0 THEN RAISE EXCEPTION 'DIGITAL_ORDER_ITEM_REQUIRED'; END IF;

  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.variant_id, oi.qty
    FROM public.order_items AS oi
    JOIN public.products AS p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id
      AND p.fulfillment_type IN ('credentials', 'code')
    ORDER BY oi.created_at, oi.id
  LOOP
    FOR v_required IN 1..v_item.qty LOOP
      SELECT u.id INTO v_unit
      FROM public.digital_inventory_units AS u
      WHERE u.product_id = v_item.product_id
        AND u.variant_id IS NOT DISTINCT FROM v_item.variant_id
        AND u.status = 'available'
        AND u.vault_secret_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.digital_unit_secret_versions AS sv
          WHERE sv.digital_inventory_unit_id = u.id
            AND sv.status = 'current'
            AND sv.version_no = u.secret_version
            AND sv.vault_secret_id = u.vault_secret_id
        )
      ORDER BY u.created_at, u.id
      FOR UPDATE SKIP LOCKED
      LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_INVENTORY_UNAVAILABLE'; END IF;

      UPDATE public.digital_inventory_units
      SET status = 'sold', order_item_id = v_item.id, sold_at = now(), updated_at = now()
      WHERE id = v_unit.id AND status = 'available';
      IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_INVENTORY_CONFLICT'; END IF;
      v_assigned := v_assigned + 1;
    END LOOP;

    INSERT INTO public.digital_access(order_id, order_item_id, session_id, access_type)
    VALUES (
      v_order.id,
      v_item.id,
      v_order.session_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.customer_profiles AS cp
        WHERE cp.session_id = v_order.session_id AND cp.email IS NOT NULL
      ) THEN 'account' ELSE 'guest' END
    )
    ON CONFLICT (order_item_id) DO NOTHING;
  END LOOP;

  INSERT INTO public.digital_deliveries(order_id, status, delivered_at)
  VALUES (v_order.id, 'delivered', now())
  ON CONFLICT (order_id) DO UPDATE
    SET status = 'delivered', delivered_at = COALESCE(public.digital_deliveries.delivered_at, now())
  RETURNING * INTO v_delivery;

  SELECT cp.email INTO v_email
  FROM public.customer_profiles AS cp
  WHERE cp.session_id = v_order.session_id
  LIMIT 1;
  v_email := COALESCE(v_email, v_order.address_snapshot->>'email');
  IF v_email IS NULL OR length(btrim(v_email)) = 0 THEN
    RAISE EXCEPTION 'DIGITAL_RECIPIENT_EMAIL_REQUIRED';
  END IF;
  v_email_type := CASE WHEN EXISTS (
    SELECT 1 FROM public.digital_access AS da
    WHERE da.order_id = v_order.id AND da.access_type = 'account'
  ) THEN 'account_digital_delivery' ELSE 'guest_digital_delivery' END;

  INSERT INTO public.digital_email_outbox(
    order_id, order_item_id, recipient_email, email_type, payload, idempotency_key
  ) VALUES (
    v_order.id, NULL, v_email, v_email_type, '{}'::jsonb,
    'clean-digital-delivery:' || v_order.id::TEXT
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN QUERY SELECT TRUE, FALSE, v_order.id, v_payment.id, v_delivery.id, v_assigned;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_clean_digital_library(p_session_id UUID)
RETURNS TABLE(
  order_id UUID,
  order_number TEXT,
  order_item_id UUID,
  access_id UUID,
  product_id UUID,
  variant_id UUID,
  product_title TEXT,
  unit_type TEXT,
  delivered_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT ON (oi.id)
         o.id, o.order_number, oi.id, da.id, u.product_id, u.variant_id,
         oi.title_snapshot, u.unit_type, d.delivered_at
  FROM public.digital_access AS da
  JOIN public.orders AS o ON o.id = da.order_id AND o.session_id = p_session_id
  JOIN public.order_items AS oi ON oi.id = da.order_item_id AND oi.order_id = o.id
  JOIN public.digital_deliveries AS d ON d.order_id = o.id AND d.status = 'delivered'
  JOIN public.digital_inventory_units AS u ON u.order_item_id = oi.id AND u.status = 'sold'
  WHERE p_session_id IS NOT NULL
  ORDER BY oi.id, d.delivered_at DESC, u.created_at, u.id;
$$;

CREATE OR REPLACE FUNCTION public.get_clean_digital_secret(
  p_order_id UUID, p_order_item_id UUID, p_session_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_secret TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.digital_access AS da
    JOIN public.digital_deliveries AS d ON d.order_id = da.order_id AND d.status = 'delivered'
    JOIN public.payments AS p ON p.order_id = da.order_id AND p.status = 'paid'
    WHERE da.order_id = p_order_id AND da.order_item_id = p_order_item_id
      AND da.session_id = p_session_id
  ) THEN RAISE EXCEPTION 'DIGITAL_ACCESS_NOT_AUTHORIZED'; END IF;

  SELECT string_agg(ds.secret, E'\n\n' ORDER BY u.created_at, u.id)
    INTO v_secret
  FROM public.digital_inventory_units AS u
  JOIN public.order_items AS oi ON oi.id = u.order_item_id
  JOIN public.digital_unit_secret_versions AS sv
    ON sv.digital_inventory_unit_id = u.id
   AND sv.status = 'current' AND sv.version_no = u.secret_version
   AND sv.vault_secret_id = u.vault_secret_id
  JOIN vault.decrypted_secrets AS ds ON ds.id = sv.vault_secret_id
  WHERE oi.order_id = p_order_id AND oi.id = p_order_item_id AND u.status = 'sold';
  IF v_secret IS NULL OR length(v_secret) = 0 THEN RAISE EXCEPTION 'DIGITAL_SECRET_UNAVAILABLE'; END IF;
  UPDATE public.digital_access SET last_accessed_at = now()
  WHERE order_id = p_order_id AND order_item_id = p_order_item_id;
  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_clean_guest_access_token(
  p_order_id UUID, p_token TEXT, p_expires_at TIMESTAMPTZ, p_idempotency_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_hash TEXT; v_count INTEGER;
BEGIN
  IF p_order_id IS NULL OR p_token IS NULL OR length(p_token) < 32
     OR p_expires_at IS NULL OR p_expires_at <= now()
     OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_GUEST_ACCESS_INPUT';
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  UPDATE public.digital_access
  SET guest_token_hash = v_hash, guest_expires_at = p_expires_at
  WHERE order_id = p_order_id AND access_type = 'guest';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'GUEST_ACCESS_NOT_READY'; END IF;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_clean_guest_secret(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_secret TEXT;
BEGIN
  SELECT string_agg(ds.secret, E'\n\n' ORDER BY u.created_at, u.id)
    INTO v_secret
  FROM public.digital_access AS da
  JOIN public.digital_deliveries AS d ON d.order_id = da.order_id AND d.status = 'delivered'
  JOIN public.payments AS p ON p.order_id = da.order_id AND p.status = 'paid'
  JOIN public.digital_inventory_units AS u ON u.order_item_id = da.order_item_id AND u.status = 'sold'
  JOIN public.digital_unit_secret_versions AS sv
    ON sv.digital_inventory_unit_id = u.id AND sv.status = 'current'
   AND sv.version_no = u.secret_version AND sv.vault_secret_id = u.vault_secret_id
  JOIN vault.decrypted_secrets AS ds ON ds.id = sv.vault_secret_id
  WHERE da.guest_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND da.guest_expires_at > now();
  IF v_secret IS NULL OR length(v_secret) = 0 THEN RAISE EXCEPTION 'DIGITAL_ACCESS_NOT_AUTHORIZED'; END IF;
  UPDATE public.digital_access
  SET last_accessed_at = now()
  WHERE guest_token_hash = encode(digest(p_token, 'sha256'), 'hex');
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment_and_deliver_digital_order(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_and_deliver_digital_order(UUID, UUID, TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_clean_digital_library(UUID),
  public.get_clean_digital_secret(UUID, UUID, UUID),
  public.set_clean_guest_access_token(UUID, TEXT, TIMESTAMPTZ, TEXT),
  public.get_clean_guest_secret(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_clean_digital_library(UUID),
  public.get_clean_digital_secret(UUID, UUID, UUID),
  public.set_clean_guest_access_token(UUID, TEXT, TIMESTAMPTZ, TEXT),
  public.get_clean_guest_secret(TEXT)
  TO service_role;

COMMENT ON TABLE public.digital_deliveries IS 'Authoritative delivery result for the clean automatic digital path.';
COMMENT ON TABLE public.digital_access IS 'Authoritative customer access boundary for the clean automatic digital path.';
COMMENT ON TABLE public.digital_unit_allocations IS 'LEGACY: not used by the clean automatic digital path.';
COMMENT ON TABLE public.digital_unit_reservations IS 'LEGACY: not used by the clean automatic digital path.';
COMMENT ON TABLE public.digital_fulfillment_allocations IS 'LEGACY: not used by the clean automatic digital path.';
