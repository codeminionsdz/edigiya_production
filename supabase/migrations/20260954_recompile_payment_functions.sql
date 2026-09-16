-- Recompile the payment functions with column precedence for legacy
-- unqualified references. This also protects databases where an older
-- function definition was applied before the qualification migrations.
DO $$
DECLARE
  v_name TEXT;
  v_definition TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'confirm_payment_and_deliver_digital_order',
    'refresh_digital_reservation_for_paid_order'
  ] LOOP
    SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = v_name
    ORDER BY p.oid DESC
    LIMIT 1;

    IF v_definition IS NOT NULL THEN
      EXECUTE v_definition;
    END IF;
  END LOOP;
END;
$$;
