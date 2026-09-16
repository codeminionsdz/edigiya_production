-- Phase 2: narrow server-only Vault write boundary.
--
-- The function accepts plaintext only from the trusted backend role, creates
-- the value in Vault, and stores only the opaque UUID in application tables.
-- It never reads/decrypts Vault data and never exposes a generic secret lookup.

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
     OR p_key_id IS NULL
     OR p_replacement_idempotency_key IS NULL
     OR length(btrim(p_replacement_idempotency_key)) = 0
     OR length(p_replacement_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_SECRET_INPUT';
  END IF;

  SELECT u.* INTO v_unit
  FROM public.digital_inventory_units AS u
  WHERE u.id = p_digital_inventory_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_NOT_FOUND';
  END IF;

  IF v_unit.unit_type NOT IN ('credential', 'code') THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_TYPE_INVALID';
  END IF;

  -- Idempotency is checked before calling Vault. A retry therefore cannot
  -- create a second Vault object or a second version row.
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
    -- Replacement is permitted only before the unit is reserved/allocated.
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

  -- The name and description are generated from non-sensitive metadata. The
  -- plaintext value is passed only to the verified Vault function below and
  -- is never copied into public tables, metadata, or events.
  v_vault_secret_id := vault.create_secret(
    p_new_secret,
    'Edigiya digital unit ' || p_digital_inventory_unit_id::TEXT,
    'Edigiya secret version ' || v_next_version::TEXT,
    p_key_id
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
    digital_inventory_unit_id,
    version_no,
    vault_secret_id,
    status,
    replacement_idempotency_key,
    created_by
  ) VALUES (
    p_digital_inventory_unit_id,
    v_next_version,
    v_vault_secret_id,
    'current',
    p_replacement_idempotency_key,
    p_actor
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

REVOKE ALL ON FUNCTION public.create_or_replace_digital_unit_secret(UUID, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_replace_digital_unit_secret(UUID, TEXT, UUID, TEXT, TEXT)
  TO service_role;
