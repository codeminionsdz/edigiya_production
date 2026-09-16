-- Commercial formula prices are independent from fulfillment stock identity.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS price_baridimob_dzd NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_flexy_dzd NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS product_variants_active_commercial_idx
  ON public.product_variants(product_id, is_active);
