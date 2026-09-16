-- Structured, admin-controlled catalog pricing. This extends the existing
-- product_variants table without introducing a second pricing system.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS external_key TEXT,
  ADD COLUMN IF NOT EXISTS option_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS price_dzd DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE product_variants AS pv
SET price_dzd = COALESCE(pv.price_dzd, p.price_dzd + pv.price_delta_dzd)
FROM products AS p
WHERE pv.product_id = p.id AND pv.price_dzd IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_external_key_idx
  ON product_variants(product_id, external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_variants_active_idx
  ON product_variants(product_id, is_active);
