-- The payment-delivery function has an output column named order_id. Qualify
-- the table column so PostgreSQL does not treat it as an ambiguous reference.
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'confirm_payment_and_deliver_digital_order'
    AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text, text';

  IF v_definition IS NOT NULL
     AND position('WHERE order_id = v_order.id' IN v_definition) > 0 THEN
    v_definition := replace(
      v_definition,
      'WHERE order_id = v_order.id',
      'WHERE public.digital_deliveries.order_id = v_order.id'
    );
    EXECUTE v_definition;
  END IF;
END;
$$;
