-- Forward fix: UUID helpers are installed in the extensions schema on the
-- live project, not in public.
-- Keep UUID generation inside the digital-inventory path on pgcrypto's
-- extensions.gen_random_uuid(), without changing any business or security
-- boundary.

ALTER TABLE public.digital_inventory_units
  ALTER COLUMN id SET DEFAULT extensions.gen_random_uuid();

ALTER TABLE public.digital_inventory_unit_operations
  ALTER COLUMN id SET DEFAULT extensions.gen_random_uuid();

CREATE OR REPLACE FUNCTION public.admin_create_digital_inventory_unit(
  p_product_id UUID,
  p_variant_id UUID,
  p_unit_type TEXT,
  p_secret TEXT,
  p_vault_key_id UUID,
  p_idempotency_key TEXT,
  p_actor TEXT DEFAULT 'admin'
)
RETURNS TABLE(
  unit_id UUID,
  product_id UUID,
  variant_id UUID,
  unit_type TEXT,
  status TEXT,
  secret_version INTEGER,
  secret_created_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_operation public.digital_inventory_unit_operations%ROWTYPE;
  v_unit public.digital_inventory_units%ROWTYPE;
BEGIN
  IF p_product_id IS NULL OR p_unit_type IS NULL OR p_unit_type NOT IN ('credential', 'code')
     OR p_secret IS NULL OR length(p_secret) = 0 OR length(p_secret) > 100000
     OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_INPUT';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products AS product_row WHERE product_row.id = p_product_id) THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_PRODUCT_NOT_FOUND';
  END IF;

  IF p_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants AS variant_row
    WHERE variant_row.id = p_variant_id
      AND variant_row.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_VARIANT_MISMATCH';
  END IF;

  INSERT INTO public.digital_inventory_unit_operations(
    idempotency_key, product_id, variant_id, unit_type, actor
  ) VALUES (
    p_idempotency_key, p_product_id, p_variant_id, p_unit_type, p_actor
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT o.* INTO v_operation
  FROM public.digital_inventory_unit_operations AS o
  WHERE o.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_operation.product_id IS DISTINCT FROM p_product_id
     OR v_operation.variant_id IS DISTINCT FROM p_variant_id
     OR v_operation.unit_type IS DISTINCT FROM p_unit_type THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_IDEMPOTENCY_MISMATCH';
  END IF;

  IF v_operation.digital_inventory_unit_id IS NOT NULL THEN
    SELECT u.* INTO v_unit
    FROM public.digital_inventory_units AS u
    WHERE u.id = v_operation.digital_inventory_unit_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_OPERATION_INCOMPLETE'; END IF;
    RETURN QUERY SELECT v_unit.id, v_unit.product_id, v_unit.variant_id,
      v_unit.unit_type, v_unit.status, v_unit.secret_version,
      v_unit.secret_created_at, v_unit.created_by, v_unit.created_at;
    RETURN;
  END IF;

  INSERT INTO public.digital_inventory_units(
    product_id, variant_id, unit_type, status, vault_secret_id,
    secret_version, created_by, updated_by, admin_note
  ) VALUES (
    p_product_id, p_variant_id, p_unit_type, 'available', extensions.gen_random_uuid(),
    1, p_actor, p_actor, 'Created through admin digital inventory operation'
  ) RETURNING * INTO v_unit;

  PERFORM public.create_or_replace_digital_unit_secret(
    v_unit.id, p_secret, NULL, p_idempotency_key, p_actor
  );

  UPDATE public.digital_inventory_unit_operations
  SET digital_inventory_unit_id = v_unit.id
  WHERE id = v_operation.id;

  RETURN QUERY SELECT v_unit.id, v_unit.product_id, v_unit.variant_id,
    v_unit.unit_type, v_unit.status, v_unit.secret_version,
    v_unit.secret_created_at, v_unit.created_by, v_unit.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_digital_inventory_unit(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_digital_inventory_unit(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT)
  TO service_role;
