-- Phase 2: digital fulfillment orchestration.
--
-- This migration connects paid digital orders to unique-unit reservations,
-- allocations, and fulfillment without reading Vault plaintext or writing
-- secrets into fulfillment_items, orders, events, or metadata.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'digital_unit_allocations_id_product_id_key'
      AND conrelid = 'public.digital_unit_allocations'::regclass
  ) THEN
    ALTER TABLE public.digital_unit_allocations
      ADD CONSTRAINT digital_unit_allocations_id_product_id_key UNIQUE (id, product_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.digital_fulfillment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fulfillment_id UUID NOT NULL
    REFERENCES public.order_fulfillments(id) ON DELETE RESTRICT,
  allocation_id UUID NOT NULL,
  order_id UUID NOT NULL
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL,
  product_id UUID NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID,
  allocation_slot INTEGER NOT NULL CHECK (allocation_slot > 0),
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'delivered', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_fulfillment_allocations_allocation_product_fk
    FOREIGN KEY (allocation_id, product_id)
    REFERENCES public.digital_unit_allocations(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_fulfillment_allocations_item_product_fk
    FOREIGN KEY (order_item_id, product_id)
    REFERENCES public.order_items(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_fulfillment_allocations_variant_fk
    FOREIGN KEY (variant_id, product_id)
    REFERENCES public.product_variants(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_fulfillment_allocations_allocation_unique
    UNIQUE (allocation_id),
  CONSTRAINT digital_fulfillment_allocations_item_slot_unique
    UNIQUE (order_item_id, allocation_slot)
);

CREATE INDEX IF NOT EXISTS digital_fulfillment_allocations_fulfillment_idx
  ON public.digital_fulfillment_allocations(fulfillment_id);
CREATE INDEX IF NOT EXISTS digital_fulfillment_allocations_order_idx
  ON public.digital_fulfillment_allocations(order_id, order_item_id);
CREATE INDEX IF NOT EXISTS digital_fulfillment_allocations_status_idx
  ON public.digital_fulfillment_allocations(status);

CREATE OR REPLACE FUNCTION public.update_digital_fulfillment_allocations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_digital_fulfillment_allocations_updated_at
  ON public.digital_fulfillment_allocations;
CREATE TRIGGER trigger_update_digital_fulfillment_allocations_updated_at
BEFORE UPDATE ON public.digital_fulfillment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_digital_fulfillment_allocations_updated_at();

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
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_FULFILLMENT_ORDER';
  END IF;

  SELECT o.id, o.delivery_method, o.status, o.session_id
    INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE';
  END IF;

  SELECT p.id, p.status
    INTO v_payment
  FROM public.payments AS p
  WHERE p.order_id = p_order_id
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_payment.status <> 'paid' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_PAID';
  END IF;

  SELECT f.* INTO v_fulfillment
  FROM public.order_fulfillments AS f
  WHERE f.order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.order_fulfillments(order_id, fulfillment_type, status)
    VALUES (p_order_id, 'manual', 'pending')
    RETURNING * INTO v_fulfillment;
  ELSIF v_fulfillment.status IN ('delivered', 'cancelled', 'failed') THEN
    RAISE EXCEPTION 'FULFILLMENT_STATE_CONFLICT';
  END IF;

  -- Deterministic item order prevents lock-order deadlocks between admins.
  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.variant_id, oi.qty,
           pr.fulfillment_type
    FROM public.order_items AS oi
    JOIN public.products AS pr ON pr.id = oi.product_id
    WHERE oi.order_id = p_order_id
    ORDER BY oi.id
    FOR UPDATE OF oi
  LOOP
    -- Only unique credential/code inventory enters this orchestration. Legacy
    -- file/link/manual fulfillment remains on its existing admin path.
    IF v_item.fulfillment_type NOT IN ('credentials', 'code') THEN
      CONTINUE;
    END IF;

    SELECT r.id, r.status, r.expires_at
      INTO v_reservation
    FROM public.inventory_reservations AS r
    WHERE r.order_id = p_order_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVENTORY_RESERVATION_NOT_FOUND'; END IF;

    SELECT count(*) INTO v_allocation_count
    FROM public.digital_fulfillment_allocations AS dfa
    WHERE dfa.fulfillment_id = v_fulfillment.id
      AND dfa.order_item_id = v_item.id;

    IF v_allocation_count = v_item.qty THEN
      CONTINUE;
    ELSIF v_allocation_count <> 0 THEN
      RAISE EXCEPTION 'DIGITAL_FULFILLMENT_PARTIAL_ALLOCATION';
    END IF;

    v_key := 'fulfillment:unit-reservation:' || p_order_id::TEXT || ':' || v_item.id::TEXT;
    FOR v_reserved IN
      SELECT *
      FROM public.reserve_digital_units_for_reservation(
        p_order_id,
        v_item.id,
        v_reservation.id,
        v_key
      )
      ORDER BY reservation_slot
    LOOP
      v_key := 'fulfillment:unit-allocation:' || p_order_id::TEXT || ':' || v_item.id::TEXT || ':' || v_reserved.reservation_slot::TEXT;
      SELECT * INTO v_allocation
      FROM public.allocate_digital_unit(
        p_order_id,
        v_item.id,
        v_reservation.id,
        v_reserved.reservation_slot,
        v_key
      );

      IF v_allocation.allocation_status <> 'allocated' THEN
        RAISE EXCEPTION 'DIGITAL_UNIT_ALLOCATION_NOT_READY';
      END IF;

      SELECT sv.id, sv.version_no
        INTO v_current_version
      FROM public.digital_unit_secret_versions AS sv
      JOIN public.digital_inventory_units AS u
        ON u.id = sv.digital_inventory_unit_id
       AND u.vault_secret_id = sv.vault_secret_id
       AND u.secret_version = sv.version_no
       AND u.status IN ('allocated', 'consumed')
      WHERE sv.digital_inventory_unit_id = v_allocation.digital_inventory_unit_id
        AND sv.status = 'current';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'DIGITAL_UNIT_SECRET_VERSION_UNAVAILABLE';
      END IF;

      INSERT INTO public.digital_fulfillment_allocations(
        fulfillment_id, allocation_id, order_id, order_item_id,
        product_id, variant_id, allocation_slot, status
      ) VALUES (
        v_fulfillment.id, v_allocation.allocation_id, p_order_id, v_item.id,
        v_item.product_id, v_item.variant_id, v_reserved.reservation_slot, 'ready'
      );
    END LOOP;
  END LOOP;

  UPDATE public.order_fulfillments
  SET status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END
  WHERE id = v_fulfillment.id
  RETURNING * INTO v_fulfillment;

  IF NOT EXISTS (
    SELECT 1 FROM public.fulfillment_events AS fe
    WHERE fe.fulfillment_id = v_fulfillment.id
      AND fe.event_type = 'fulfillment_processing'
      AND fe.metadata->>'operation' = 'digital_orchestration'
  ) THEN
    INSERT INTO public.fulfillment_events(
      fulfillment_id, event_type, actor_type, actor_id, metadata
    ) VALUES (
      v_fulfillment.id, 'fulfillment_processing', 'admin',
      NULLIF(btrim(p_actor_id), ''),
      jsonb_build_object('operation', 'digital_orchestration')
    );
  END IF;

  RETURN v_fulfillment;
END;
$$;

-- Extend the existing delivery gate to accept allocation-backed fulfillment,
-- while preserving the legacy fulfillment_items path.
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
      OR EXISTS (SELECT 1 FROM public.digital_fulfillment_allocations AS dfa WHERE dfa.fulfillment_id = f.id AND dfa.status = 'ready')
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_FULFILLMENT_NOT_ELIGIBLE'; END IF;

  UPDATE public.order_fulfillments
  SET status = 'delivered', delivered_at = now()
  WHERE id = v_fulfillment.id AND status IN ('pending', 'processing')
  RETURNING * INTO v_fulfillment;
  IF NOT FOUND THEN RAISE EXCEPTION 'FULFILLMENT_STATE_CONFLICT'; END IF;

  UPDATE public.digital_fulfillment_allocations
  SET status = 'delivered'
  WHERE fulfillment_id = v_fulfillment.id AND status = 'ready';

  INSERT INTO public.fulfillment_events(
    fulfillment_id, event_type, actor_type, actor_id, metadata
  ) VALUES (
    v_fulfillment.id, 'fulfillment_delivered', 'admin',
    NULLIF(btrim(p_actor_id), ''), '{}'::jsonb
  );

  RETURN v_fulfillment;
END;
$$;

ALTER TABLE public.digital_fulfillment_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.digital_fulfillment_allocations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.digital_fulfillment_allocations TO service_role;

REVOKE ALL ON FUNCTION public.orchestrate_digital_fulfillment(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orchestrate_digital_fulfillment(UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.admin_deliver_order_atomic(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deliver_order_atomic(UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.update_digital_fulfillment_allocations_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
