-- Root fix for legacy function bodies where order_id is both an output
-- column/variable and a table column. Regex handles formatting differences
-- between previously applied function versions.
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
    AND oidvectortypes(p.proargtypes) = 'uuid, uuid, text, text'
  ORDER BY p.oid DESC
  LIMIT 1;

  IF v_definition IS NOT NULL THEN
    v_definition := regexp_replace(
      v_definition,
      'WHERE[[:space:]]+order_id[[:space:]]*=[[:space:]]*v_order\.id',
      'WHERE public.digital_deliveries.order_id = v_order.id',
      'g'
    );
    EXECUTE v_definition;
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'refresh_digital_reservation_for_paid_order'
    AND oidvectortypes(p.proargtypes) = 'uuid'
  ORDER BY p.oid DESC
  LIMIT 1;

  IF v_definition IS NOT NULL THEN
    v_definition := regexp_replace(
      v_definition,
      'FROM[[:space:]]+public\.payments([[:space:]]+)WHERE[[:space:]]+order_id',
      'FROM public.payments\1WHERE public.payments.order_id',
      'g'
    );
    v_definition := regexp_replace(
      v_definition,
      'WHERE[[:space:]]+order_id[[:space:]]*=[[:space:]]*p_order_id([[:space:]]+AND[[:space:]]+status[[:space:]]*=[[:space:]]*''active'')',
      'WHERE public.inventory_reservations.order_id = p_order_id\1',
      'g'
    );
    EXECUTE v_definition;
  END IF;
END;
$$;
