-- Phase 2: authenticated account digital-delivery access.
--
-- This migration exposes only non-secret delivered-item metadata to the
-- trusted server boundary. Plaintext remains behind the existing
-- get_digital_unit_secret_for_session function and is never stored here.

CREATE TABLE IF NOT EXISTS public.digital_delivery_access_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  allocation_id UUID NOT NULL
    REFERENCES public.digital_unit_allocations(id) ON DELETE RESTRICT,
  access_type TEXT NOT NULL
    CHECK (access_type IN ('library_list', 'secret_retrieval')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_delivery_access_event_unique
    UNIQUE (session_id, order_id, allocation_id, access_type)
);

CREATE INDEX IF NOT EXISTS digital_delivery_access_events_order_idx
  ON public.digital_delivery_access_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_delivery_access_events_session_idx
  ON public.digital_delivery_access_events(session_id, created_at DESC);

ALTER TABLE public.digital_delivery_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.digital_delivery_access_events
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.digital_delivery_access_events TO service_role;

CREATE OR REPLACE FUNCTION public.get_account_digital_library(
  p_session_id UUID
)
RETURNS TABLE(
  order_id UUID,
  order_number TEXT,
  order_item_id UUID,
  allocation_id UUID,
  fulfillment_id UUID,
  product_id UUID,
  variant_id UUID,
  allocation_slot INTEGER,
  product_title TEXT,
  unit_type TEXT,
  delivered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_LIBRARY_NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    oi.id,
    dfa.allocation_id,
    f.id,
    dfa.product_id,
    dfa.variant_id,
    dfa.allocation_slot,
    oi.title_snapshot,
    u.unit_type,
    f.delivered_at
  FROM public.orders AS o
  JOIN public.order_items AS oi
    ON oi.order_id = o.id
  JOIN public.payments AS p
    ON p.order_id = o.id
   AND p.status = 'paid'
  JOIN public.order_fulfillments AS f
    ON f.order_id = o.id
   AND f.status = 'delivered'
  JOIN public.digital_fulfillment_allocations AS dfa
    ON dfa.fulfillment_id = f.id
   AND dfa.order_id = o.id
   AND dfa.order_item_id = oi.id
   AND dfa.product_id = oi.product_id
   AND dfa.variant_id IS NOT DISTINCT FROM oi.variant_id
   AND dfa.status = 'delivered'
  JOIN public.digital_unit_allocations AS a
    ON a.id = dfa.allocation_id
   AND a.order_id = o.id
   AND a.order_item_id = oi.id
   AND a.product_id = dfa.product_id
   AND a.variant_id IS NOT DISTINCT FROM dfa.variant_id
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
  JOIN public.products AS product
    ON product.id = oi.product_id
   AND product.fulfillment_type IN ('credentials', 'code')
  WHERE o.session_id = p_session_id
    AND o.delivery_method = 'digital'
  ORDER BY o.created_at DESC, oi.id, dfa.allocation_slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_account_digital_delivery_access(
  p_session_id UUID,
  p_order_id UUID,
  p_allocation_id UUID,
  p_access_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_session_id IS NULL OR p_order_id IS NULL OR p_allocation_id IS NULL
     OR p_access_type NOT IN ('library_list', 'secret_retrieval') THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS o
    JOIN public.payments AS p
      ON p.order_id = o.id AND p.status = 'paid'
    JOIN public.order_fulfillments AS f
      ON f.order_id = o.id AND f.status = 'delivered'
    JOIN public.digital_fulfillment_allocations AS dfa
      ON dfa.fulfillment_id = f.id
     AND dfa.order_id = o.id
     AND dfa.allocation_id = p_allocation_id
     AND dfa.status = 'delivered'
    JOIN public.digital_unit_allocations AS a
      ON a.id = dfa.allocation_id
     AND a.order_id = o.id
     AND a.status IN ('allocated', 'consumed')
    JOIN public.digital_inventory_units AS u
      ON u.id = a.digital_inventory_unit_id
     AND u.status IN ('allocated', 'consumed')
    JOIN public.digital_unit_secret_versions AS sv
      ON sv.digital_inventory_unit_id = u.id
     AND sv.status = 'current'
     AND sv.version_no = u.secret_version
     AND sv.vault_secret_id = u.vault_secret_id
    WHERE o.id = p_order_id
      AND o.session_id = p_session_id
      AND o.delivery_method = 'digital'
  ) THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  INSERT INTO public.digital_delivery_access_events(
    session_id, order_id, allocation_id, access_type
  ) VALUES (
    p_session_id, p_order_id, p_allocation_id, p_access_type
  )
  ON CONFLICT (session_id, order_id, allocation_id, access_type)
  DO UPDATE SET created_at = public.digital_delivery_access_events.created_at
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Keep the existing secret boundary, but require the allocation to be part of
-- the delivered allocation-backed fulfillment as well as the existing checks.
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
DECLARE
  v_secret TEXT;
BEGIN
  IF p_order_id IS NULL OR p_allocation_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  SELECT ds.decrypted_secret
    INTO v_secret
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
    AND o.session_id = p_session_id
    AND o.delivery_method = 'digital'
    AND a.product_id = oi.product_id
    AND a.variant_id IS NOT DISTINCT FROM oi.variant_id;

  IF NOT FOUND OR v_secret IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_account_digital_library(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_digital_library(UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.record_account_digital_delivery_access(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_account_digital_delivery_access(UUID, UUID, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID)
  TO service_role;
