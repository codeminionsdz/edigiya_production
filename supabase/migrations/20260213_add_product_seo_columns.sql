ALTER TABLE products
  ADD COLUMN IF NOT EXISTS meta_title_fr TEXT,
  ADD COLUMN IF NOT EXISTS meta_title_ar TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_fr TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_ar TEXT;

CREATE INDEX IF NOT EXISTS idx_products_meta_title_fr ON products(meta_title_fr);
CREATE INDEX IF NOT EXISTS idx_products_meta_title_ar ON products(meta_title_ar);

