-- Phase 1 drift repair: align live reservations with the intended audit lifecycle.
-- Forward-only; stock, payment transitions, and existing movement rows are unchanged.

-- Backfill only missing reservation movements. The deterministic key makes this
-- safe to retry and preserves all existing history.
INSERT INTO inventory_movements(
  order_id, reservation_id, product_id, variant_id, movement_type,
  quantity_delta, idempotency_key, metadata
)
SELECT r.order_id, ri.reservation_id, ri.product_id, ri.variant_id, 'reserved',
  -CASE WHEN ri.stock_reserved THEN ri.quantity ELSE 0 END,
  'reservation:' || ri.reservation_id || ':item:' || ri.id || ':reserved',
  jsonb_build_object('stock_reserved', ri.stock_reserved, 'backfilled', true)
FROM inventory_reservation_items ri
JOIN inventory_reservations r ON r.id = ri.reservation_id
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_movements im
  WHERE im.idempotency_key = 'reservation:' || ri.reservation_id || ':item:' || ri.id || ':reserved'
)
ON CONFLICT (idempotency_key) DO NOTHING;

CREATE OR REPLACE FUNCTION record_inventory_reservation_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_order_id UUID;
BEGIN
  SELECT order_id INTO v_order_id
  FROM inventory_reservations WHERE id = NEW.reservation_id;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'INVALID_INVENTORY_RESERVATION'; END IF;

  INSERT INTO inventory_movements(
    order_id, reservation_id, product_id, variant_id, movement_type,
    quantity_delta, idempotency_key, metadata
  ) VALUES (
    v_order_id, NEW.reservation_id, NEW.product_id, NEW.variant_id, 'reserved',
    -CASE WHEN NEW.stock_reserved THEN NEW.quantity ELSE 0 END,
    'reservation:' || NEW.reservation_id || ':item:' || NEW.id || ':reserved',
    jsonb_build_object('stock_reserved', NEW.stock_reserved)
  ) ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_record_inventory_reservation_movement ON inventory_reservation_items;
CREATE TRIGGER trigger_record_inventory_reservation_movement
AFTER INSERT ON inventory_reservation_items
FOR EACH ROW EXECUTE FUNCTION record_inventory_reservation_movement();

REVOKE ALL ON FUNCTION record_inventory_reservation_movement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_inventory_reservation_movement() TO service_role;
