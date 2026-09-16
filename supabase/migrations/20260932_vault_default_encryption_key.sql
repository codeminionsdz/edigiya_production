-- Phase 2: use Supabase Vault's project-default encryption key.
--
-- The historical p_key_id parameters remain in these RPC signatures for
-- compatibility with already deployed callers. They are deliberately ignored
-- and are no longer required by the application. No plaintext or Vault value
-- is stored in application tables or returned to callers.

CREATE OR REPLACE FUNCTION public.create_or_replace_digital_unit_secret(
  p_digital_inventory_unit_id UUID,
  p_new_secret TEXT,
  p_key_id UUID,
  p_replacement_idempotency_key TEXT,
  p_actor TEXT DEFAULT 'server'
)
RETURNS TABLE(
  secret_version_id UUID,
  digital_inventory_unit_id UUID,
  version_no INTEGER,
  version_status TEXT,
  vault_secret_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit public.digital_inventory_units%ROWTYPE;
  v_current public.digital_unit_secret_versions%ROWTYPE;
  v_existing public.digital_unit_secret_versions%ROWTYPE;
  v_new public.digital_unit_secret_versions%ROWTYPE;
  v_next_version INTEGER;
  v_vault_secret_id UUID;
  v_has_current BOOLEAN := FALSE;
BEGIN
  IF p_digital_inventory_unit_id IS NULL
     OR p_new_secret IS NULL
     OR length(p_new_secret) = 0
     OR length(p_new_secret) > 100000
     OR p_replacement_idempotency_key IS NULL
     OR length(btrim(p_replacement_idempotency_key)) = 0
     OR length(p_replacement_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_SECRET_INPUT';
  END IF;

  SELECT u.* INTO v_unit
  FROM public.digital_inventory_units AS u
  WHERE u.id = p_digital_inventory_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_NOT_FOUND'; END IF;
  IF v_unit.unit_type NOT IN ('credential', 'code') THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_TYPE_INVALID';
  END IF;

  SELECT v.* INTO v_existing
  FROM public.digital_unit_secret_versions AS v
  WHERE v.digital_inventory_unit_id = p_digital_inventory_unit_id
    AND v.replacement_idempotency_key = p_replacement_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.digital_inventory_unit_id,
      v_existing.version_no, v_existing.status, v_existing.vault_secret_id;
    RETURN;
  END IF;

  SELECT v.* INTO v_current
  FROM public.digital_unit_secret_versions AS v
  WHERE v.digital_inventory_unit_id = p_digital_inventory_unit_id
    AND v.status = 'current'
  FOR UPDATE;

  IF FOUND THEN
    v_has_current := TRUE;
    IF v_unit.status <> 'available' THEN
      RAISE EXCEPTION 'DIGITAL_SECRET_REPLACEMENT_NOT_ALLOWED';
    END IF;
    v_next_version := v_current.version_no + 1;
  ELSE
    IF v_unit.status <> 'available' OR v_unit.secret_version <> 1 THEN
      RAISE EXCEPTION 'DIGITAL_SECRET_INITIAL_VERSION_NOT_ALLOWED';
    END IF;
    v_next_version := 1;
  END IF;

  -- Three-argument create_secret uses Supabase Vault's project-default key.
  -- p_key_id is intentionally retained only as a deprecated compatibility
  -- parameter and is never passed to Vault or persisted.
  v_vault_secret_id := vault.create_secret(
    p_new_secret,
    'Edigiya digital unit ' || p_digital_inventory_unit_id::TEXT,
    'Edigiya secret version ' || v_next_version::TEXT
  );

  IF v_vault_secret_id IS NULL THEN
    RAISE EXCEPTION 'VAULT_SECRET_CREATION_FAILED';
  END IF;

  IF v_has_current THEN
    UPDATE public.digital_unit_secret_versions
    SET status = 'retired', retired_at = now(), retired_by = p_actor
    WHERE id = v_current.id AND status = 'current';
  END IF;

  INSERT INTO public.digital_unit_secret_versions(
    digital_inventory_unit_id, version_no, vault_secret_id, status,
    replacement_idempotency_key, created_by
  ) VALUES (
    p_digital_inventory_unit_id, v_next_version, v_vault_secret_id, 'current',
    p_replacement_idempotency_key, p_actor
  )
  RETURNING * INTO v_new;

  UPDATE public.digital_inventory_units
  SET vault_secret_id = v_new.vault_secret_id,
      secret_version = v_new.version_no,
      secret_created_at = CASE WHEN v_current.id IS NULL THEN now() ELSE secret_created_at END,
      secret_rotated_at = CASE WHEN v_current.id IS NULL THEN secret_rotated_at ELSE now() END,
      updated_by = p_actor
  WHERE id = p_digital_inventory_unit_id;

  RETURN QUERY SELECT v_new.id, v_new.digital_inventory_unit_id,
    v_new.version_no, v_new.status, v_new.vault_secret_id;
END;
$$;

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

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_PRODUCT_NOT_FOUND';
  END IF;

  IF p_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE id = p_variant_id AND product_id = p_product_id
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
    p_product_id, p_variant_id, p_unit_type, 'available', uuid_generate_v4(),
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

REVOKE ALL ON FUNCTION public.create_or_replace_digital_unit_secret(UUID, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_replace_digital_unit_secret(UUID, TEXT, UUID, TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_create_digital_inventory_unit(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_digital_inventory_unit(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT)
  TO service_role;
