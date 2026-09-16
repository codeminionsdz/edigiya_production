-- The legacy fulfillment table accepts only the historical value `manual`.
-- Product delivery itself is driven by digital_inventory_units; this value is
-- retained only so existing account pages can display the delivery status.
DO $$
DECLARE
  function_sql TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO function_sql
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'deliver_paid_product_units'
  ORDER BY p.oid DESC
  LIMIT 1;

  IF function_sql IS NOT NULL THEN
    function_sql := replace(
      function_sql,
      'VALUES (p_order_id, ''credentials'', ''delivered'', now())',
      'VALUES (p_order_id, ''manual'', ''delivered'', now())'
    );
    EXECUTE function_sql;
  END IF;
END;
$$;
