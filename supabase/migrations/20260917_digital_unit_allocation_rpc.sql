-- Phase 2: server-side unique digital-unit allocation primitive.
--
-- This migration only adds the allocation RPC. It does not retrieve Vault
-- plaintext, create delivery grants, change payment RPCs, or change Phase 1
-- stock/reservation functions.

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
  v_reservation_item RECORD;
  v_unit public.digital_inventory_units%ROWTYPE;
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

  -- A retry with the same key returns the original allocation. Reject reuse
  -- of the key for a different logical allocation instead of hiding misuse.
  SELECT *
    INTO v_existing
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

    RETURN QUERY SELECT
      v_existing.id,
      v_existing.digital_inventory_unit_id,
      v_existing.status,
      v_existing.allocation_slot;
    RETURN;
  END IF;

  SELECT oi.order_id, oi.product_id, oi.variant_id, oi.qty
    INTO v_item
  FROM public.order_items AS oi
  WHERE oi.id = p_order_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH';
  END IF;

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
     OR p_allocation_slot > v_reservation_item.quantity THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ITEM_MISMATCH';
  END IF;

  -- A slot may never be silently replaced, including after release/revoke.
  IF EXISTS (
    SELECT 1
    FROM public.digital_unit_allocations AS a
    WHERE a.order_item_id = p_order_item_id
      AND a.allocation_slot = p_allocation_slot
  ) THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ALLOCATION_SLOT_ALREADY_EXISTS';
  END IF;

  -- SKIP LOCKED makes concurrent callers move to another unit, or fail when
  -- the final unit is already locked. The status update and allocation insert
  -- are in this transaction and are protected again by the 20260916 trigger
  -- and partial unique index.
  SELECT u.*
    INTO v_unit
  FROM public.digital_inventory_units AS u
  WHERE u.product_id = v_item.product_id
    AND u.variant_id IS NOT DISTINCT FROM v_item.variant_id
    AND u.status = 'available'
  ORDER BY u.created_at, u.id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE';
  END IF;

  UPDATE public.digital_inventory_units
  SET status = 'reserved', updated_by = 'allocation_rpc'
  WHERE id = v_unit.id AND status = 'available';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE';
  END IF;

  INSERT INTO public.digital_unit_allocations(
    digital_inventory_unit_id,
    order_id,
    order_item_id,
    reservation_id,
    product_id,
    variant_id,
    allocation_slot,
    status,
    idempotency_key,
    created_by,
    updated_by,
    metadata
  ) VALUES (
    v_unit.id,
    p_order_id,
    p_order_item_id,
    p_reservation_id,
    v_item.product_id,
    v_item.variant_id,
    p_allocation_slot,
    'reserved',
    p_idempotency_key,
    'allocation_rpc',
    'allocation_rpc',
    jsonb_build_object('source', '20260917')
  )
    RETURNING
    public.digital_unit_allocations.id,
    public.digital_unit_allocations.digital_inventory_unit_id,
    public.digital_unit_allocations.status,
    public.digital_unit_allocations.allocation_slot
  INTO allocation_id, digital_inventory_unit_id, allocation_status, allocation_slot;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_digital_unit(UUID, UUID, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.allocate_digital_unit(UUID, UUID, UUID, INTEGER, TEXT)
  TO service_role;
