-- Phase 2: bridge Phase 1 reservations to unique digital units.
--
-- This is a forward-only compatibility correction. It does not rewrite prior
-- migrations, retrieve Vault plaintext, change payment RPCs, or decrement
-- Phase 1 stock a second time.

CREATE TABLE IF NOT EXISTS public.digital_unit_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digital_inventory_unit_id UUID NOT NULL
    REFERENCES public.digital_inventory_units(id) ON DELETE RESTRICT,
  reservation_id UUID NOT NULL
    REFERENCES public.inventory_reservations(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL,
  product_id UUID NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID,
  reservation_slot INTEGER NOT NULL CHECK (reservation_slot > 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'allocated', 'consumed', 'released', 'revoked')),
  reservation_idempotency_key TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  allocated_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_unit_reservations_unit_product_fk
    FOREIGN KEY (digital_inventory_unit_id, product_id)
    REFERENCES public.digital_inventory_units(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_unit_reservations_item_product_fk
    FOREIGN KEY (order_item_id, product_id)
    REFERENCES public.order_items(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_unit_reservations_variant_fk
    FOREIGN KEY (variant_id, product_id)
    REFERENCES public.product_variants(id, product_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS digital_unit_reservations_active_unit_idx
  ON public.digital_unit_reservations(digital_inventory_unit_id)
  WHERE status IN ('reserved', 'allocated', 'consumed');

CREATE UNIQUE INDEX IF NOT EXISTS digital_unit_reservations_item_slot_idx
  ON public.digital_unit_reservations(reservation_id, order_item_id, reservation_slot);

CREATE INDEX IF NOT EXISTS digital_unit_reservations_operation_idx
  ON public.digital_unit_reservations(reservation_id, order_item_id, reservation_idempotency_key);

CREATE INDEX IF NOT EXISTS digital_unit_reservations_status_idx
  ON public.digital_unit_reservations(status);

CREATE OR REPLACE FUNCTION public.validate_digital_unit_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit RECORD;
  v_item RECORD;
  v_reservation RECORD;
BEGIN
  SELECT u.product_id, u.variant_id, u.status
    INTO v_unit
  FROM public.digital_inventory_units AS u
  WHERE u.id = NEW.digital_inventory_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_NOT_FOUND';
  END IF;

  SELECT oi.order_id, oi.product_id, oi.variant_id
    INTO v_item
  FROM public.order_items AS oi
  WHERE oi.id = NEW.order_item_id
  FOR UPDATE;

  IF NOT FOUND
     OR NEW.order_id IS DISTINCT FROM v_item.order_id
     OR NEW.product_id IS DISTINCT FROM v_item.product_id
     OR NEW.variant_id IS DISTINCT FROM v_item.variant_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ITEM_MISMATCH';
  END IF;

  SELECT r.order_id, r.status
    INTO v_reservation
  FROM public.inventory_reservations AS r
  WHERE r.id = NEW.reservation_id
  FOR UPDATE;

  IF NOT FOUND OR v_reservation.order_id IS DISTINCT FROM NEW.order_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_MISMATCH';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status <> 'reserved' THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_MUST_START_RESERVED';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'reserved' AND NEW.status IN ('allocated', 'released', 'revoked'))
      OR (OLD.status = 'allocated' AND NEW.status IN ('consumed', 'released', 'revoked'))
      OR (OLD.status IN ('consumed', 'released', 'revoked') AND NEW.status = OLD.status)
    ) THEN
      RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_RESERVATION_TRANSITION';
    END IF;
  END IF;

  IF NEW.status = 'reserved' AND v_unit.status <> 'reserved' THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_NOT_RESERVED';
  ELSIF NEW.status = 'allocated' AND v_unit.status <> 'allocated' THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_STATUS_MISMATCH';
  ELSIF NEW.status = 'consumed' AND v_unit.status <> 'consumed' THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_STATUS_MISMATCH';
  ELSIF NEW.status = 'released' AND v_unit.status <> 'available' THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_STATUS_MISMATCH';
  ELSIF NEW.status = 'revoked' AND v_unit.status <> 'revoked' THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_STATUS_MISMATCH';
  END IF;

  IF NEW.status = 'allocated' AND NEW.allocated_at IS NULL THEN
    NEW.allocated_at = now();
  ELSIF NEW.status = 'consumed' AND NEW.consumed_at IS NULL THEN
    NEW.consumed_at = now();
  ELSIF NEW.status = 'released' AND NEW.released_at IS NULL THEN
    NEW.released_at = now();
  ELSIF NEW.status = 'revoked' AND NEW.revoked_at IS NULL THEN
    NEW.revoked_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_digital_unit_reservation
  ON public.digital_unit_reservations;

CREATE TRIGGER trigger_validate_digital_unit_reservation
BEFORE INSERT OR UPDATE ON public.digital_unit_reservations
FOR EACH ROW
EXECUTE FUNCTION public.validate_digital_unit_reservation();

CREATE OR REPLACE FUNCTION public.update_digital_unit_reservations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_digital_unit_reservations_updated_at
  ON public.digital_unit_reservations;

CREATE TRIGGER trigger_update_digital_unit_reservations_updated_at
BEFORE UPDATE ON public.digital_unit_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_digital_unit_reservations_updated_at();

CREATE OR REPLACE FUNCTION public.reserve_digital_units_for_reservation(
  p_order_id UUID,
  p_order_item_id UUID,
  p_reservation_id UUID,
  p_reservation_idempotency_key TEXT
)
RETURNS TABLE(
  reservation_unit_id UUID,
  digital_inventory_unit_id UUID,
  reservation_slot INTEGER,
  reservation_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item RECORD;
  v_reservation RECORD;
  v_reservation_item RECORD;
  v_existing RECORD;
  v_unit RECORD;
  v_slot INTEGER := 0;
  v_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL
     OR p_order_item_id IS NULL
     OR p_reservation_id IS NULL
     OR p_reservation_idempotency_key IS NULL
     OR length(btrim(p_reservation_idempotency_key)) = 0
     OR length(p_reservation_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_RESERVATION_INPUT';
  END IF;

  -- Serialize all retries for this Phase 1 reservation. The second caller
  -- observes the committed rows and returns them instead of duplicating them.
  SELECT r.order_id, r.status, r.expires_at
    INTO v_reservation
  FROM public.inventory_reservations AS r
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_reservation.order_id IS DISTINCT FROM p_order_id
     OR v_reservation.status <> 'active'
     OR v_reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_UNAVAILABLE';
  END IF;

  SELECT oi.order_id, oi.product_id, oi.variant_id, oi.qty
    INTO v_item
  FROM public.order_items AS oi
  WHERE oi.id = p_order_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH';
  END IF;

  SELECT ri.product_id, ri.variant_id, ri.quantity
    INTO v_reservation_item
  FROM public.inventory_reservation_items AS ri
  WHERE ri.reservation_id = p_reservation_id
    AND ri.product_id = v_item.product_id
    AND ri.variant_id IS NOT DISTINCT FROM v_item.variant_id
  ORDER BY ri.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
     OR v_reservation_item.quantity IS DISTINCT FROM v_item.qty
     OR v_item.qty < 1 THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ITEM_MISMATCH';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.digital_unit_reservations AS dur
  WHERE dur.reservation_id = p_reservation_id
    AND dur.order_item_id = p_order_item_id
    AND dur.reservation_idempotency_key = p_reservation_idempotency_key;

  IF v_count > 0 THEN
    IF v_count <> v_item.qty THEN
      RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_INCOMPLETE_RETRY';
    END IF;
    RETURN QUERY SELECT
      dur.id, dur.digital_inventory_unit_id, dur.reservation_slot, dur.status
    FROM public.digital_unit_reservations AS dur
    WHERE dur.reservation_id = p_reservation_id
      AND dur.order_item_id = p_order_item_id
      AND dur.reservation_idempotency_key = p_reservation_idempotency_key
    ORDER BY dur.reservation_slot;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.digital_unit_reservations AS dur
    WHERE dur.reservation_id = p_reservation_id
      AND dur.order_item_id = p_order_item_id
  ) THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ALREADY_EXISTS';
  END IF;

  FOR v_unit IN
    SELECT u.id, u.product_id, u.variant_id
    FROM public.digital_inventory_units AS u
    WHERE u.product_id = v_item.product_id
      AND u.variant_id IS NOT DISTINCT FROM v_item.variant_id
      AND u.status = 'available'
    ORDER BY u.created_at, u.id
    LIMIT v_item.qty
    FOR UPDATE SKIP LOCKED
  LOOP
    v_slot := v_slot + 1;

    UPDATE public.digital_inventory_units
    SET status = 'reserved', updated_by = 'reservation_rpc'
    WHERE id = v_unit.id AND status = 'available';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE';
    END IF;

    INSERT INTO public.digital_unit_reservations(
      digital_inventory_unit_id,
      reservation_id,
      order_id,
      order_item_id,
      product_id,
      variant_id,
      reservation_slot,
      status,
      reservation_idempotency_key,
      created_by,
      updated_by,
      metadata
    ) VALUES (
      v_unit.id,
      p_reservation_id,
      p_order_id,
      p_order_item_id,
      v_item.product_id,
      v_item.variant_id,
      v_slot,
      'reserved',
      p_reservation_idempotency_key,
      'reservation_rpc',
      'reservation_rpc',
      jsonb_build_object('source', '20260918')
    )
    RETURNING public.digital_unit_reservations.id, public.digital_unit_reservations.digital_inventory_unit_id, public.digital_unit_reservations.reservation_slot, public.digital_unit_reservations.status
    INTO reservation_unit_id, digital_inventory_unit_id, reservation_slot, reservation_status;

    RETURN NEXT;
  END LOOP;

  IF v_slot <> v_item.qty THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_INSUFFICIENT_AVAILABLE_UNITS';
  END IF;
END;
$$;

-- Forward-correct 20260917's allocator: it now consumes the reservation
-- bridge and performs reserved -> allocated. It never chooses an unreserved
-- unit and never touches Phase 1 stock.
CREATE OR REPLACE FUNCTION public.allocate_digital_unit(
  p_order_id UUID,
  p_order_item_id UUID,
  p_reservation_id UUID,
  p_allocation_slot INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE(
  allocation_id UUID,
  digital_inventory_unit_id UUID,
  allocation_status TEXT,
  allocation_slot INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.digital_unit_allocations%ROWTYPE;
  v_item RECORD;
  v_reservation RECORD;
  v_bridge RECORD;
BEGIN
  IF p_order_id IS NULL
     OR p_order_item_id IS NULL
     OR p_reservation_id IS NULL
     OR p_allocation_slot IS NULL
     OR p_allocation_slot < 1
     OR p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_ALLOCATION_INPUT';
  END IF;

  SELECT * INTO v_existing
  FROM public.digital_unit_allocations AS a
  WHERE a.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.order_id IS DISTINCT FROM p_order_id
       OR v_existing.order_item_id IS DISTINCT FROM p_order_item_id
       OR v_existing.reservation_id IS DISTINCT FROM p_reservation_id
       OR v_existing.allocation_slot IS DISTINCT FROM p_allocation_slot THEN
      RAISE EXCEPTION 'DIGITAL_UNIT_ALLOCATION_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.digital_inventory_unit_id,
      v_existing.status, v_existing.allocation_slot;
    RETURN;
  END IF;

  SELECT oi.order_id, oi.product_id, oi.variant_id, oi.qty
    INTO v_item
  FROM public.order_items AS oi
  WHERE oi.id = p_order_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id
     OR p_allocation_slot > v_item.qty THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH';
  END IF;

  SELECT r.order_id, r.status, r.expires_at
    INTO v_reservation
  FROM public.inventory_reservations AS r
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND OR v_reservation.order_id IS DISTINCT FROM p_order_id
     OR v_reservation.status <> 'active'
     OR v_reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_UNAVAILABLE';
  END IF;

  SELECT dur.* INTO v_bridge
  FROM public.digital_unit_reservations AS dur
  WHERE dur.reservation_id = p_reservation_id
    AND dur.order_id = p_order_id
    AND dur.order_item_id = p_order_item_id
    AND dur.product_id = v_item.product_id
    AND dur.variant_id IS NOT DISTINCT FROM v_item.variant_id
    AND dur.reservation_slot = p_allocation_slot
    AND dur.status = 'reserved'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_NOT_RESERVED_FOR_ORDER_ITEM';
  END IF;

  INSERT INTO public.digital_unit_allocations(
    digital_inventory_unit_id, order_id, order_item_id, reservation_id,
    product_id, variant_id, allocation_slot, status, idempotency_key,
    created_by, updated_by, metadata
  ) VALUES (
    v_bridge.digital_inventory_unit_id, p_order_id, p_order_item_id,
    p_reservation_id, v_item.product_id, v_item.variant_id, p_allocation_slot,
    'reserved', p_idempotency_key, 'allocation_rpc', 'allocation_rpc',
    jsonb_build_object('source', '20260918')
  )
  RETURNING id INTO allocation_id;

  UPDATE public.digital_inventory_units
  SET status = 'allocated', updated_by = 'allocation_rpc'
  WHERE id = v_bridge.digital_inventory_unit_id AND status = 'reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_STATUS_MISMATCH'; END IF;

  UPDATE public.digital_unit_reservations
  SET status = 'allocated', updated_by = 'allocation_rpc'
  WHERE id = v_bridge.id AND status = 'reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_STATE_MISMATCH'; END IF;

  UPDATE public.digital_unit_allocations
  SET status = 'allocated', updated_by = 'allocation_rpc'
  WHERE id = allocation_id AND status = 'reserved'
  RETURNING public.digital_unit_allocations.digital_inventory_unit_id, public.digital_unit_allocations.status, public.digital_unit_allocations.allocation_slot
  INTO digital_inventory_unit_id, allocation_status, allocation_slot;

  RETURN NEXT;
END;
$$;

ALTER TABLE public.digital_unit_reservations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.digital_unit_reservations
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.digital_unit_reservations TO service_role;

REVOKE ALL ON FUNCTION public.validate_digital_unit_reservation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_digital_unit_reservations_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_digital_units_for_reservation(UUID, UUID, UUID, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.allocate_digital_unit(UUID, UUID, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_digital_unit(UUID, UUID, UUID, INTEGER, TEXT)
  TO service_role;
