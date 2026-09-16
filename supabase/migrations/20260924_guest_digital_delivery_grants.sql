-- Phase 2: guest digital-delivery grants.
--
-- Only opaque token hashes are stored. This migration does not create secrets,
-- send email, or expose Vault metadata to guest callers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'digital_fulfillment_allocations_item_allocation_key'
      AND conrelid = 'public.digital_fulfillment_allocations'::regclass
  ) THEN
    ALTER TABLE public.digital_fulfillment_allocations
      ADD CONSTRAINT digital_fulfillment_allocations_item_allocation_key
      UNIQUE (order_item_id, allocation_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.guest_digital_delivery_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL,
  allocation_id UUID NOT NULL
    REFERENCES public.digital_unit_allocations(id) ON DELETE RESTRICT,
  fulfillment_id UUID NOT NULL
    REFERENCES public.order_fulfillments(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  grant_idempotency_key TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  first_redeemed_at TIMESTAMPTZ,
  last_redeemed_at TIMESTAMPTZ,
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  CONSTRAINT guest_grant_order_item_product_fk
    FOREIGN KEY (order_item_id, allocation_id)
    REFERENCES public.digital_fulfillment_allocations(order_item_id, allocation_id)
    ON DELETE RESTRICT
);

-- The composite target above is only valid when the parent has the matching
-- unique key; keep the exact order/allocation relationship enforced by the
-- validation function below as well.
CREATE INDEX IF NOT EXISTS guest_digital_delivery_grants_order_idx
  ON public.guest_digital_delivery_grants(order_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS guest_digital_delivery_grants_allocation_idx
  ON public.guest_digital_delivery_grants(allocation_id);
CREATE INDEX IF NOT EXISTS guest_digital_delivery_grants_active_idx
  ON public.guest_digital_delivery_grants(expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_digital_delivery_access_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL UNIQUE
    REFERENCES public.guest_digital_delivery_grants(id) ON DELETE RESTRICT,
  first_redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redemption_count INTEGER NOT NULL DEFAULT 1 CHECK (redemption_count > 0)
);

ALTER TABLE public.guest_digital_delivery_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_digital_delivery_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guest_digital_delivery_grants,
  public.guest_digital_delivery_access_events
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guest_digital_delivery_grants,
  public.guest_digital_delivery_access_events TO service_role;

CREATE OR REPLACE FUNCTION public.create_guest_digital_delivery_grant(
  p_order_id UUID,
  p_order_item_id UUID,
  p_allocation_id UUID,
  p_fulfillment_id UUID,
  p_token TEXT,
  p_expires_at TIMESTAMPTZ,
  p_grant_idempotency_key TEXT,
  p_actor TEXT DEFAULT 'server'
)
RETURNS TABLE(grant_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.guest_digital_delivery_grants%ROWTYPE;
  v_grant public.guest_digital_delivery_grants%ROWTYPE;
  v_hash TEXT;
BEGIN
  IF p_order_id IS NULL OR p_order_item_id IS NULL OR p_allocation_id IS NULL
     OR p_fulfillment_id IS NULL OR p_token IS NULL
     OR length(p_token) < 32 OR length(p_token) > 512
     OR p_expires_at IS NULL OR p_expires_at <= now()
     OR p_grant_idempotency_key IS NULL
     OR length(btrim(p_grant_idempotency_key)) = 0
     OR length(p_grant_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_GUEST_DELIVERY_GRANT';
  END IF;

  SELECT g.* INTO v_existing
  FROM public.guest_digital_delivery_grants AS g
  WHERE g.grant_idempotency_key = p_grant_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.order_id IS DISTINCT FROM p_order_id
       OR v_existing.order_item_id IS DISTINCT FROM p_order_item_id
       OR v_existing.allocation_id IS DISTINCT FROM p_allocation_id
       OR v_existing.fulfillment_id IS DISTINCT FROM p_fulfillment_id THEN
      RAISE EXCEPTION 'GUEST_DELIVERY_GRANT_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.expires_at;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS o
    JOIN public.payments AS p ON p.order_id = o.id AND p.status = 'paid'
    JOIN public.order_items AS oi ON oi.id = p_order_item_id AND oi.order_id = o.id
    JOIN public.order_fulfillments AS f
      ON f.id = p_fulfillment_id AND f.order_id = o.id AND f.status = 'delivered'
    JOIN public.digital_fulfillment_allocations AS dfa
      ON dfa.fulfillment_id = f.id
     AND dfa.order_id = o.id
     AND dfa.order_item_id = oi.id
     AND dfa.allocation_id = p_allocation_id
     AND dfa.status = 'delivered'
    JOIN public.digital_unit_allocations AS a
      ON a.id = dfa.allocation_id
     AND a.order_id = o.id
     AND a.order_item_id = oi.id
     AND a.status IN ('allocated', 'consumed')
    JOIN public.digital_inventory_units AS u
      ON u.id = a.digital_inventory_unit_id
     AND u.product_id = a.product_id
     AND u.variant_id IS NOT DISTINCT FROM a.variant_id
     AND u.status IN ('allocated', 'consumed')
    JOIN public.digital_unit_secret_versions AS sv
      ON sv.digital_inventory_unit_id = u.id
     AND sv.status = 'current'
     AND sv.version_no = u.secret_version
     AND sv.vault_secret_id = u.vault_secret_id
    WHERE o.id = p_order_id
      AND o.delivery_method = 'digital'
      AND dfa.product_id = oi.product_id
      AND dfa.variant_id IS NOT DISTINCT FROM oi.variant_id
  ) THEN
    RAISE EXCEPTION 'GUEST_DELIVERY_NOT_ELIGIBLE';
  END IF;

  v_hash := encode(digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO public.guest_digital_delivery_grants(
    order_id, order_item_id, allocation_id, fulfillment_id,
    token_hash, grant_idempotency_key, expires_at, created_by
  ) VALUES (
    p_order_id, p_order_item_id, p_allocation_id, p_fulfillment_id,
    v_hash, p_grant_idempotency_key, p_expires_at, p_actor
  )
  RETURNING * INTO v_grant;

  RETURN QUERY SELECT v_grant.id, v_grant.expires_at;
END;
$$;

-- One Vault retrieval boundary serves account and guest delivery. The guest
-- form derives all identities from the hashed grant and accepts no IDs.
CREATE OR REPLACE FUNCTION public.get_digital_unit_secret_for_session(
  p_order_id UUID,
  p_allocation_id UUID,
  p_session_id UUID,
  p_guest_token TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret TEXT;
  v_grant public.guest_digital_delivery_grants%ROWTYPE;
  v_hash TEXT;
  v_guest BOOLEAN := p_guest_token IS NOT NULL;
BEGIN
  IF v_guest THEN
    IF p_order_id IS NOT NULL OR p_allocation_id IS NOT NULL OR p_session_id IS NOT NULL
       OR length(p_guest_token) < 32 OR length(p_guest_token) > 512 THEN
      RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
    END IF;
    v_hash := encode(digest(convert_to(p_guest_token, 'UTF8'), 'sha256'), 'hex');
    SELECT g.* INTO v_grant
    FROM public.guest_digital_delivery_grants AS g
    WHERE g.token_hash = v_hash
    FOR UPDATE;
    IF NOT FOUND OR v_grant.revoked_at IS NOT NULL OR v_grant.expires_at <= now() THEN
      RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
    END IF;
    p_order_id := v_grant.order_id;
    p_allocation_id := v_grant.allocation_id;
  ELSIF p_order_id IS NULL OR p_allocation_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  SELECT ds.decrypted_secret INTO v_secret
  FROM public.orders AS o
  JOIN public.order_items AS oi ON oi.order_id = o.id
  JOIN public.payments AS p ON p.order_id = o.id AND p.status = 'paid'
  JOIN public.order_fulfillments AS f
    ON f.order_id = o.id AND f.status = 'delivered'
  JOIN public.digital_fulfillment_allocations AS dfa
    ON dfa.fulfillment_id = f.id
   AND dfa.order_id = o.id
   AND dfa.allocation_id = p_allocation_id
   AND dfa.order_item_id = oi.id
   AND dfa.status = 'delivered'
  JOIN public.digital_unit_allocations AS a
    ON a.id = dfa.allocation_id
   AND a.order_id = o.id
   AND a.order_item_id = oi.id
   AND a.status IN ('allocated', 'consumed')
  JOIN public.digital_inventory_units AS u
    ON u.id = a.digital_inventory_unit_id
   AND u.product_id = a.product_id
   AND u.variant_id IS NOT DISTINCT FROM a.variant_id
   AND u.status IN ('allocated', 'consumed')
  JOIN public.digital_unit_secret_versions AS sv
    ON sv.digital_inventory_unit_id = u.id
   AND sv.status = 'current'
   AND sv.version_no = u.secret_version
   AND sv.vault_secret_id = u.vault_secret_id
  JOIN vault.decrypted_secrets AS ds ON ds.id = sv.vault_secret_id
  WHERE o.id = p_order_id
    AND a.product_id = oi.product_id
    AND a.variant_id IS NOT DISTINCT FROM oi.variant_id
    AND (v_guest OR o.session_id = p_session_id);

  IF NOT FOUND OR v_secret IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  IF v_guest THEN
    UPDATE public.guest_digital_delivery_grants
    SET first_redeemed_at = COALESCE(first_redeemed_at, now()),
        last_redeemed_at = now(),
        redemption_count = redemption_count + 1
    WHERE id = v_grant.id;
    INSERT INTO public.guest_digital_delivery_access_events(grant_id)
    VALUES (v_grant.id)
    ON CONFLICT (grant_id) DO UPDATE
      SET last_redeemed_at = now(),
          redemption_count = public.guest_digital_delivery_access_events.redemption_count + 1;
  END IF;

  RETURN v_secret;
END;
$$;

-- Preserve the existing three-argument account caller while routing it through
-- the same shared Vault boundary and its delivered-allocation checks.
CREATE OR REPLACE FUNCTION public.get_digital_unit_secret_for_session(
  p_order_id UUID,
  p_allocation_id UUID,
  p_session_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.get_digital_unit_secret_for_session(
    p_order_id, p_allocation_id, p_session_id, NULL::TEXT
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_digital_delivery_grant(UUID, UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_digital_delivery_grant(UUID, UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID)
  TO service_role;
