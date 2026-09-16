-- Simple live fix: qualify the only ambiguous reference in the admin
-- payment verification function.
DO $$
DECLARE
  function_sql TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO function_sql
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'confirm_payment_and_deliver_digital_order'
    AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text, text'
  LIMIT 1;

  IF function_sql IS NULL THEN
    RAISE EXCEPTION 'confirm_payment_and_deliver_digital_order function not found';
  END IF;

  function_sql := replace(
    function_sql,
    'WHERE order_id = v_order.id',
    'WHERE public.digital_deliveries.order_id = v_order.id'
  );

  EXECUTE function_sql;
END;
$$;
