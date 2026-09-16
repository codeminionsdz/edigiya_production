-- Qualify order_id references in payment/digital-delivery functions. PL/pgSQL
-- output columns and parameters can otherwise collide with table columns.
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

  IF v_definition IS NOT NULL THEN
    v_definition := replace(v_definition, 'WHERE order_id = v_order.id', 'WHERE public.digital_deliveries.order_id = v_order.id');
    EXECUTE v_definition;
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'refresh_digital_reservation_for_paid_order'
    AND oidvectortypes(p.proargtypes) = 'uuid';

  IF v_definition IS NOT NULL THEN
    v_definition := replace(v_definition, 'FROM public.payments' || chr(10) || '    WHERE order_id = p_order_id', 'FROM public.payments' || chr(10) || '    WHERE public.payments.order_id = p_order_id');
    v_definition := replace(v_definition, 'WHERE order_id = p_order_id' || chr(10) || '    AND status = ''active''', 'WHERE public.inventory_reservations.order_id = p_order_id' || chr(10) || '    AND status = ''active''');
    EXECUTE v_definition;
  END IF;
END;
$$;
