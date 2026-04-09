-- Allow hard-deleting products (and thus departments) without breaking order history.
-- We keep order_items snapshots (title/unit_price/qty/line_total) and set product/variant references to NULL.

BEGIN;

-- product_id: allow NULL + set null on product delete
ALTER TABLE order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES products(id)
  ON DELETE SET NULL;

-- variant_id: set null on variant delete (variants are deleted when product is deleted)
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id)
  REFERENCES product_variants(id)
  ON DELETE SET NULL;

COMMIT;

