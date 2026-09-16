-- Phase 2: unique digital-unit allocation foundation.
--
-- This migration adds allocation metadata and invariants only. It does not
-- allocate a unit, retrieve Vault plaintext, create delivery grants, or change
-- the Phase 1 payment/inventory RPCs.

-- Composite references make product identity part of the foreign-key contract.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_id_product_id_key'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_id_product_id_key UNIQUE (id, product_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'digital_inventory_units_id_product_id_key'
      AND conrelid = 'public.digital_inventory_units'::regclass
  ) THEN
    ALTER TABLE public.digital_inventory_units
      ADD CONSTRAINT digital_inventory_units_id_product_id_key UNIQUE (id, product_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.digital_unit_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digital_inventory_unit_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL,
  reservation_id UUID NOT NULL
    REFERENCES public.inventory_reservations(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID,
  allocation_slot INTEGER NOT NULL DEFAULT 1
    CHECK (allocation_slot > 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'allocated', 'consumed', 'released', 'revoked')),
  idempotency_key TEXT NOT NULL UNIQUE,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  allocated_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  admin_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_unit_allocations_unit_product_fk
    FOREIGN KEY (digital_inventory_unit_id, product_id)
    REFERENCES public.digital_inventory_units(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_unit_allocations_item_product_fk
    FOREIGN KEY (order_item_id, product_id)
    REFERENCES public.order_items(id, product_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_unit_allocations_item_slot_unique
    UNIQUE (order_item_id, allocation_slot)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'digital_unit_allocations_variant_fk'
      AND conrelid = 'public.digital_unit_allocations'::regclass
  ) THEN
    ALTER TABLE public.digital_unit_allocations
      ADD CONSTRAINT digital_unit_allocations_variant_fk
      FOREIGN KEY (variant_id, product_id)
      REFERENCES public.product_variants(id, product_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS digital_unit_allocations_active_unit_idx
  ON public.digital_unit_allocations(digital_inventory_unit_id)
  WHERE status IN ('reserved', 'allocated', 'consumed');

CREATE INDEX IF NOT EXISTS digital_unit_allocations_order_idx
  ON public.digital_unit_allocations(order_id, order_item_id);

CREATE INDEX IF NOT EXISTS digital_unit_allocations_reservation_idx
  ON public.digital_unit_allocations(reservation_id);

CREATE INDEX IF NOT EXISTS digital_unit_allocations_status_idx
  ON public.digital_unit_allocations(status);

CREATE OR REPLACE FUNCTION public.validate_digital_unit_allocation()
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_ITEM_NOT_FOUND';
  END IF;

  IF NEW.order_id IS DISTINCT FROM v_item.order_id
     OR NEW.product_id IS DISTINCT FROM v_item.product_id
     OR NEW.variant_id IS DISTINCT FROM v_item.variant_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ALLOCATION_OWNERSHIP_MISMATCH';
  END IF;

  IF v_unit.variant_id IS DISTINCT FROM NEW.variant_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_VARIANT_MISMATCH';
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
    RAISE EXCEPTION 'DIGITAL_UNIT_ALLOCATION_MUST_START_RESERVED';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'reserved' AND NEW.status IN ('allocated', 'released', 'revoked'))
      OR (OLD.status = 'allocated' AND NEW.status IN ('consumed', 'released', 'revoked'))
      OR (OLD.status IN ('consumed', 'released', 'revoked') AND NEW.status = OLD.status)
    ) THEN
      RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_ALLOCATION_TRANSITION';
    END IF;
  END IF;

  IF NEW.status = 'reserved' AND v_unit.status NOT IN ('available', 'reserved') THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_NOT_AVAILABLE_FOR_RESERVATION';
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

DROP TRIGGER IF EXISTS trigger_validate_digital_unit_allocation
  ON public.digital_unit_allocations;

CREATE TRIGGER trigger_validate_digital_unit_allocation
BEFORE INSERT OR UPDATE ON public.digital_unit_allocations
FOR EACH ROW
EXECUTE FUNCTION public.validate_digital_unit_allocation();

CREATE OR REPLACE FUNCTION public.update_digital_unit_allocations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_digital_unit_allocations_updated_at
  ON public.digital_unit_allocations;

CREATE TRIGGER trigger_update_digital_unit_allocations_updated_at
BEFORE UPDATE ON public.digital_unit_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_digital_unit_allocations_updated_at();

ALTER TABLE public.digital_unit_allocations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.digital_unit_allocations
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.digital_unit_allocations TO service_role;

REVOKE ALL ON FUNCTION public.validate_digital_unit_allocation()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_digital_unit_allocations_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
