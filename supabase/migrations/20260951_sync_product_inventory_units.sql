-- Product-only inventory compatibility for products created before the
-- digital fulfillment type was selected. A product with inventory units is
-- digital even when its legacy fulfillment_type still says manual.

CREATE OR REPLACE FUNCTION public.sync_digital_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product_id UUID := COALESCE(NEW.product_id, OLD.product_id);
  v_unit_type TEXT;
BEGIN
  SELECT u.unit_type
  INTO v_unit_type
  FROM public.digital_inventory_units u
  WHERE u.product_id = v_product_id
  ORDER BY u.created_at, u.id
  LIMIT 1;

  UPDATE public.products p
  SET stock = (
        SELECT count(*)::INTEGER
        FROM public.digital_inventory_units u
        WHERE u.product_id = v_product_id AND u.status = 'available'
      ),
      fulfillment_type = CASE
        WHEN v_unit_type = 'credential' THEN 'credentials'
        WHEN v_unit_type = 'code' THEN 'code'
        ELSE p.fulfillment_type
      END,
      updated_at = now()
  WHERE p.id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

UPDATE public.products p
SET stock = (
      SELECT count(*)::INTEGER
      FROM public.digital_inventory_units u
      WHERE u.product_id = p.id AND u.status = 'available'
    ),
    fulfillment_type = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.digital_inventory_units u
        WHERE u.product_id = p.id AND u.unit_type = 'credential'
      ) THEN 'credentials'
      WHEN EXISTS (
        SELECT 1 FROM public.digital_inventory_units u
        WHERE u.product_id = p.id AND u.unit_type = 'code'
      ) THEN 'code'
      ELSE p.fulfillment_type
    END
WHERE EXISTS (
  SELECT 1 FROM public.digital_inventory_units u WHERE u.product_id = p.id
);
