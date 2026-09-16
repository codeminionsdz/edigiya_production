-- Phase 2: trusted admin operations for digital inventory units.
-- Plaintext is accepted only by the existing service_role Vault boundary.
-- No Vault value or vault UUID is returned to the browser.

CREATE TABLE IF NOT EXISTS public.digital_inventory_unit_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('credential', 'code')),
  digital_inventory_unit_id UUID REFERENCES public.digital_inventory_units(id) ON DELETE RESTRICT,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_inventory_unit_operations_variant_fk
    FOREIGN KEY (variant_id, product_id)
    REFERENCES public.product_variants(id, product_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS digital_inventory_unit_operations_product_idx
  ON public.digital_inventory_unit_operations(product_id, created_at DESC);

ALTER TABLE public.digital_inventory_unit_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.digital_inventory_unit_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.digital_inventory_unit_operations TO service_role;

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
     OR p_vault_key_id IS NULL OR p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0 OR length(p_idempotency_key) > 255 THEN
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

  -- The operation row is the durable idempotency record. It contains no
  -- plaintext, Vault UUID, or secret fingerprint.
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

  -- This is the only plaintext-to-Vault path. Its returned Vault metadata is
  -- intentionally discarded inside this function.
  PERFORM public.create_or_replace_digital_unit_secret(
    v_unit.id, p_secret, p_vault_key_id, p_idempotency_key, p_actor
  );

  UPDATE public.digital_inventory_unit_operations
  SET digital_inventory_unit_id = v_unit.id
  WHERE id = v_operation.id;

  RETURN QUERY SELECT v_unit.id, v_unit.product_id, v_unit.variant_id,
    v_unit.unit_type, v_unit.status, v_unit.secret_version,
    v_unit.secret_created_at, v_unit.created_by, v_unit.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_digital_inventory_unit_status(
  p_unit_id UUID,
  p_status TEXT,
  p_actor TEXT DEFAULT 'admin'
)
RETURNS TABLE(unit_id UUID, product_id UUID, variant_id UUID, unit_type TEXT, status TEXT, secret_version INTEGER, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_unit public.digital_inventory_units%ROWTYPE;
BEGIN
  IF p_unit_id IS NULL OR p_status IS NULL OR p_status NOT IN ('disabled', 'revoked') THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_UNIT_STATUS_INPUT';
  END IF;
  SELECT * INTO v_unit FROM public.digital_inventory_units WHERE id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DIGITAL_UNIT_NOT_FOUND'; END IF;
  IF v_unit.status <> 'available' THEN
    RAISE EXCEPTION 'DIGITAL_UNIT_STATUS_TRANSITION_NOT_ALLOWED';
  END IF;
  UPDATE public.digital_inventory_units
  SET status = p_status, updated_by = p_actor,
      disabled_by = CASE WHEN p_status = 'disabled' THEN p_actor ELSE disabled_by END,
      disabled_at = CASE WHEN p_status = 'disabled' THEN now() ELSE disabled_at END
  WHERE id = p_unit_id
  RETURNING id, product_id, variant_id, unit_type, status, secret_version, updated_at
  INTO unit_id, product_id, variant_id, unit_type, status, secret_version, updated_at;
  RETURN NEXT;
END
$$;

REVOKE ALL ON FUNCTION public.admin_create_digital_inventory_unit(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_digital_inventory_unit(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_set_digital_inventory_unit_status(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_digital_inventory_unit_status(UUID, TEXT, TEXT)
  TO service_role;
