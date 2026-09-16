-- Phase 2: digital inventory unit metadata foundation.
--
-- This migration stores only opaque Supabase Vault references. It does not
-- create, read, or migrate any Vault secret and does not change Phase 1 RPCs.

-- A composite key is used when the legacy variant table exists. Product-only
-- deployments may intentionally have no product_variants table.
DO $$
BEGIN
  IF to_regclass('public.product_variants') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_id_product_id_key'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_id_product_id_key UNIQUE (id, product_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.digital_inventory_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL
    REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID,
  unit_type TEXT NOT NULL
    CHECK (unit_type IN ('credential', 'code')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'allocated', 'consumed', 'disabled', 'revoked')),
  vault_secret_id UUID NOT NULL,
  secret_version INTEGER NOT NULL DEFAULT 1
    CHECK (secret_version > 0),
  secret_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  secret_rotated_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  disabled_by TEXT,
  disabled_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_inventory_units_vault_secret_unique
  UNIQUE (vault_secret_id)
);

DO $$
BEGIN
  IF to_regclass('public.product_variants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'digital_inventory_units_product_variant_fk'
         AND conrelid = 'public.digital_inventory_units'::regclass
     ) THEN
    ALTER TABLE public.digital_inventory_units
      ADD CONSTRAINT digital_inventory_units_product_variant_fk
      FOREIGN KEY (variant_id, product_id)
      REFERENCES public.product_variants(id, product_id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS digital_inventory_units_product_idx
  ON public.digital_inventory_units(product_id);

CREATE INDEX IF NOT EXISTS digital_inventory_units_variant_idx
  ON public.digital_inventory_units(variant_id)
  WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS digital_inventory_units_available_idx
  ON public.digital_inventory_units(product_id, variant_id, id)
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS digital_inventory_units_status_idx
  ON public.digital_inventory_units(status);

CREATE OR REPLACE FUNCTION public.update_digital_inventory_units_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_digital_inventory_units_updated_at
  ON public.digital_inventory_units;

CREATE TRIGGER trigger_update_digital_inventory_units_updated_at
BEFORE UPDATE ON public.digital_inventory_units
FOR EACH ROW
EXECUTE FUNCTION public.update_digital_inventory_units_updated_at();

ALTER TABLE public.digital_inventory_units ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.digital_inventory_units
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.digital_inventory_units TO service_role;

REVOKE ALL ON FUNCTION public.update_digital_inventory_units_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
