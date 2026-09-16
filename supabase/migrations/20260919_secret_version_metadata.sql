-- Phase 2: opaque digital-unit secret version metadata.
--
-- This migration never creates, reads, or decrypts a Vault secret. It records
-- only opaque Vault UUIDs and keeps the current business-secret version
-- explicit and auditable. Customer delivery remains intentionally absent.

CREATE TABLE IF NOT EXISTS public.digital_unit_secret_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digital_inventory_unit_id UUID NOT NULL
    REFERENCES public.digital_inventory_units(id) ON DELETE RESTRICT,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  vault_secret_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'current'
    CHECK (status IN ('current', 'retired', 'revoked')),
  replacement_idempotency_key TEXT NOT NULL,
  created_by TEXT,
  retired_by TEXT,
  revoked_by TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT digital_unit_secret_versions_unit_version_unique
    UNIQUE (digital_inventory_unit_id, version_no),
  CONSTRAINT digital_unit_secret_versions_vault_unique
    UNIQUE (vault_secret_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS digital_unit_secret_versions_current_idx
  ON public.digital_unit_secret_versions(digital_inventory_unit_id)
  WHERE status = 'current';

CREATE UNIQUE INDEX IF NOT EXISTS digital_unit_secret_versions_operation_idx
  ON public.digital_unit_secret_versions(
    digital_inventory_unit_id, replacement_idempotency_key
  );

CREATE INDEX IF NOT EXISTS digital_unit_secret_versions_unit_idx
  ON public.digital_unit_secret_versions(digital_inventory_unit_id, version_no DESC);

CREATE OR REPLACE FUNCTION public.register_digital_unit_secret_version(
  p_digital_inventory_unit_id UUID,
  p_vault_secret_id UUID,
  p_version_no INTEGER,
  p_replacement_idempotency_key TEXT,
  p_actor TEXT DEFAULT 'server'
)
RETURNS TABLE(
  secret_version_id UUID,
  digital_inventory_unit_id UUID,
  version_no INTEGER,
  version_status TEXT,
  is_current BOOLEAN
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
BEGIN
  IF p_digital_inventory_unit_id IS NULL
     OR p_vault_secret_id IS NULL
     OR p_version_no IS NULL
     OR p_version_no < 1
     OR p_replacement_idempotency_key IS NULL
     OR length(btrim(p_replacement_idempotency_key)) = 0
     OR length(p_replacement_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_SECRET_VERSION_INPUT';
  END IF;

  SELECT u.* INTO v_unit
  FROM public.digital_inventory_units AS u
  WHERE u.id = p_digital_inventory_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_NOT_FOUND';
  END IF;

  -- Replaying a completed registration/replacement is safe and returns the
  -- same metadata row. The Vault value is never touched.
  SELECT v.* INTO v_existing
  FROM public.digital_unit_secret_versions AS v
  WHERE v.digital_inventory_unit_id = p_digital_inventory_unit_id
    AND v.replacement_idempotency_key = p_replacement_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.vault_secret_id IS DISTINCT FROM p_vault_secret_id
       OR v_existing.version_no IS DISTINCT FROM p_version_no THEN
      RAISE EXCEPTION 'DIGITAL_SECRET_VERSION_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.digital_inventory_unit_id,
      v_existing.version_no, v_existing.status, v_existing.status = 'current';
    RETURN;
  END IF;

  SELECT v.* INTO v_current
  FROM public.digital_unit_secret_versions AS v
  WHERE v.digital_inventory_unit_id = p_digital_inventory_unit_id
    AND v.status = 'current'
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Bootstrap version 1 only from the opaque reference already recorded on
    -- the unit. This preserves the 20260915 compatibility columns.
    IF p_version_no <> 1
       OR v_unit.secret_version <> 1
       OR v_unit.vault_secret_id IS DISTINCT FROM p_vault_secret_id THEN
      RAISE EXCEPTION 'DIGITAL_SECRET_INITIAL_VERSION_MISMATCH';
    END IF;
  ELSE
    -- Safe default from the approved policy: replacement is allowed only
    -- before allocation. Existing allocations retain their ownership and
    -- cannot be silently pointed at a new secret.
    IF v_unit.status <> 'available' THEN
      RAISE EXCEPTION 'DIGITAL_SECRET_REPLACEMENT_NOT_ALLOWED';
    END IF;
    IF p_version_no <> v_current.version_no + 1
       OR p_vault_secret_id = v_current.vault_secret_id THEN
      RAISE EXCEPTION 'DIGITAL_SECRET_VERSION_SEQUENCE_INVALID';
    END IF;

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
    p_version_no,
    p_vault_secret_id,
    'current',
    p_replacement_idempotency_key,
    p_actor
  )
  RETURNING * INTO v_new;

  -- Keep the existing 20260915 compatibility pointer synchronized with the
  -- authoritative current version row.
  UPDATE public.digital_inventory_units
  SET vault_secret_id = v_new.vault_secret_id,
      secret_version = v_new.version_no,
      secret_rotated_at = CASE
        WHEN v_current.id IS NULL THEN secret_rotated_at
        ELSE now()
      END,
      updated_by = p_actor
  WHERE id = p_digital_inventory_unit_id;

  RETURN QUERY SELECT v_new.id, v_new.digital_inventory_unit_id,
    v_new.version_no, v_new.status, TRUE;
END;
$$;

ALTER TABLE public.digital_unit_secret_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.digital_unit_secret_versions
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.digital_unit_secret_versions TO service_role;

REVOKE ALL ON FUNCTION public.register_digital_unit_secret_version(UUID, UUID, INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_digital_unit_secret_version(UUID, UUID, INTEGER, TEXT, TEXT)
  TO service_role;
