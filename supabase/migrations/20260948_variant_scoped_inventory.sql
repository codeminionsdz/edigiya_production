-- Variant-scoped digital inventory.
-- Payment method remains pricing-only; it never selects a stock pool.

-- Keep the legacy column/data intact for safe rollout, but stop using the
-- commercial-variant-to-stock-variant indirection. New reservations always
-- match the exact ordered variant.

CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;
  UPDATE public.products AS p
  SET stock = COALESCE((
    SELECT SUM(GREATEST(pv.stock, 0))
    FROM public.product_variants AS pv
    WHERE pv.product_id = v_product_id
      AND pv.is_active = true
  ), 0), updated_at = now()
  WHERE p.id = v_product_id
    AND EXISTS (
      SELECT 1 FROM public.product_variants AS pv
      WHERE pv.product_id = v_product_id
    );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_product_stock_from_variants
  ON public.product_variants;
CREATE TRIGGER trigger_sync_product_stock_from_variants
AFTER INSERT OR UPDATE OF stock, is_active OR DELETE
ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_stock_from_variants();

CREATE OR REPLACE FUNCTION public.protect_variantized_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND EXISTS (
       SELECT 1 FROM public.product_variants AS pv
       WHERE pv.product_id = OLD.id
     ) THEN
    NEW.stock := COALESCE((
      SELECT SUM(GREATEST(pv.stock, 0))
      FROM public.product_variants AS pv
      WHERE pv.product_id = OLD.id AND pv.is_active = true
    ), 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_variantized_product_stock
  ON public.products;
CREATE TRIGGER trigger_protect_variantized_product_stock
BEFORE UPDATE OF stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.protect_variantized_product_stock();

UPDATE public.products AS p
SET stock = COALESCE((
  SELECT SUM(GREATEST(pv.stock, 0))
  FROM public.product_variants AS pv
  WHERE pv.product_id = p.id AND pv.is_active = true
), 0), updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.product_variants AS pv
  WHERE pv.product_id = p.id
);

CREATE OR REPLACE FUNCTION public.require_variant_for_digital_inventory_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.variant_id IS NULL
     AND EXISTS (
       SELECT 1 FROM public.products AS p
       WHERE p.id = NEW.product_id
         AND p.fulfillment_type IN ('credentials', 'code')
     )
     AND EXISTS (
       SELECT 1 FROM public.product_variants AS pv
       WHERE pv.product_id = NEW.product_id
     ) THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_VARIANT_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_require_variant_for_digital_inventory_unit
  ON public.digital_inventory_units;
CREATE TRIGGER trigger_require_variant_for_digital_inventory_unit
BEFORE INSERT ON public.digital_inventory_units
FOR EACH ROW
EXECUTE FUNCTION public.require_variant_for_digital_inventory_unit();

-- Exact variant matching. BaridiMob and Flexy therefore share the same
-- product_variants.stock and the same credential pool.
CREATE OR REPLACE FUNCTION public.reserve_digital_units_for_reservation(
  p_order_id UUID, p_order_item_id UUID, p_reservation_id UUID, p_reservation_idempotency_key TEXT
)
RETURNS TABLE(reservation_unit_id UUID, digital_inventory_unit_id UUID, reservation_slot INTEGER, reservation_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_item RECORD; v_reservation RECORD; v_reservation_item RECORD; v_unit RECORD;
  v_slot INTEGER := 0; v_count INTEGER := 0;
BEGIN
  IF p_order_id IS NULL OR p_order_item_id IS NULL OR p_reservation_id IS NULL
     OR p_reservation_idempotency_key IS NULL OR length(btrim(p_reservation_idempotency_key)) = 0
     OR length(p_reservation_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_RESERVATION_INPUT';
  END IF;

  SELECT r.order_id, r.status, r.expires_at INTO v_reservation
  FROM public.inventory_reservations r WHERE r.id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.order_id IS DISTINCT FROM p_order_id
     OR v_reservation.status <> 'active' OR v_reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_UNAVAILABLE';
  END IF;

  SELECT oi.order_id, oi.product_id, oi.variant_id, oi.qty INTO v_item
  FROM public.order_items oi WHERE oi.id = p_order_item_id FOR UPDATE;
  IF NOT FOUND OR v_item.order_id IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_ORDER_ITEM_MISMATCH';
  END IF;
  IF v_item.variant_id IS NULL AND EXISTS (
    SELECT 1 FROM public.product_variants pv WHERE pv.product_id = v_item.product_id
  ) THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_VARIANT_REQUIRED';
  END IF;

  SELECT ri.product_id, ri.variant_id, ri.quantity INTO v_reservation_item
  FROM public.inventory_reservation_items ri
  WHERE ri.reservation_id = p_reservation_id
    AND ri.product_id = v_item.product_id
    AND ri.variant_id IS NOT DISTINCT FROM v_item.variant_id
  ORDER BY ri.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_reservation_item.quantity IS DISTINCT FROM v_item.qty OR v_item.qty < 1 THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ITEM_MISMATCH';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.digital_unit_reservations dur
  WHERE dur.reservation_id = p_reservation_id
    AND dur.order_item_id = p_order_item_id
    AND dur.reservation_idempotency_key = p_reservation_idempotency_key;
  IF v_count > 0 THEN
    IF v_count <> v_item.qty THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_INCOMPLETE_RETRY'; END IF;
    RETURN QUERY SELECT dur.id, dur.digital_inventory_unit_id, dur.reservation_slot, dur.status
    FROM public.digital_unit_reservations dur
    WHERE dur.reservation_id = p_reservation_id AND dur.order_item_id = p_order_item_id
      AND dur.reservation_idempotency_key = p_reservation_idempotency_key
    ORDER BY dur.reservation_slot;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.digital_unit_reservations dur
    WHERE dur.reservation_id = p_reservation_id AND dur.order_item_id = p_order_item_id
  ) THEN RAISE EXCEPTION 'DIGITAL_UNIT_RESERVATION_ALREADY_EXISTS'; END IF;

  FOR v_unit IN
    SELECT u.id
    FROM public.digital_inventory_units u
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
    IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_UNAVAILABLE'; END IF;

    INSERT INTO public.digital_unit_reservations(
      digital_inventory_unit_id, reservation_id, order_id, order_item_id,
      product_id, variant_id, reservation_slot, status,
      reservation_idempotency_key, created_by, updated_by, metadata
    ) VALUES (
      v_unit.id, p_reservation_id, p_order_id, p_order_item_id,
      v_item.product_id, v_item.variant_id, v_slot, 'reserved',
      p_reservation_idempotency_key, 'reservation_rpc', 'reservation_rpc',
      jsonb_build_object('variant_id', v_item.variant_id)
    )
    RETURNING id, digital_inventory_unit_id, reservation_slot, status
    INTO reservation_unit_id, digital_inventory_unit_id, reservation_slot, reservation_status;
    RETURN NEXT;
  END LOOP;

  IF v_slot <> v_item.qty THEN
    RAISE EXCEPTION 'Stock insuffisant — aucun compte disponible pour cette formule.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_stock_from_variants(), public.protect_variantized_product_stock(), public.require_variant_for_digital_inventory_unit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_product_stock_from_variants(), public.protect_variantized_product_stock(), public.require_variant_for_digital_inventory_unit() TO service_role;
