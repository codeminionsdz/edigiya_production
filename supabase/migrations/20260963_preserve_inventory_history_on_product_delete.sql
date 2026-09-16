-- Preserve reservation and stock-movement history when a catalog product is
-- hard-deleted. The related order/product snapshots remain available, while
-- the optional catalog reference is cleared.

BEGIN;

ALTER TABLE public.inventory_reservation_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.inventory_reservation_items
  DROP CONSTRAINT IF EXISTS inventory_reservation_items_product_id_fkey;

ALTER TABLE public.inventory_reservation_items
  ADD CONSTRAINT inventory_reservation_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;

ALTER TABLE public.inventory_reservation_items
  DROP CONSTRAINT IF EXISTS inventory_reservation_items_variant_id_fkey;

ALTER TABLE public.inventory_reservation_items
  ADD CONSTRAINT inventory_reservation_items_variant_id_fkey
  FOREIGN KEY (variant_id)
  REFERENCES public.product_variants(id)
  ON DELETE SET NULL;

ALTER TABLE public.inventory_movements
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_variant_id_fkey;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_variant_id_fkey
  FOREIGN KEY (variant_id)
  REFERENCES public.product_variants(id)
  ON DELETE SET NULL;

COMMIT;