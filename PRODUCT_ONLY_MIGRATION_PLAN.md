# Product-only migration plan

## Current model

Products own the catalog and a legacy `product_variants` table currently owns
commercial formula prices and stock. Cart/order rows and digital inventory
records retain nullable `variant_id` references for historical compatibility.

## Target model

Every sellable formula is a product. Products own
`price_baridimob_dzd`, `price_flexy_dzd`, `price_slickpay_dzd`, and the product
stock boundary. New cart, checkout, order, reservation, and fulfillment paths
use `product_id`; legacy variant data remains readable but is not required.

## Affected objects

- `products`: three payment-specific price columns.
- `digital_inventory_units`: nullable legacy `variant_id`; product/status index.
- Digital inventory trigger/RPC: available digital stock is product-scoped.
- Checkout RPC: validates the selected product price and creates order items
  with `variant_id = NULL`.
- Admin/product/customer UI and repository projections.

## Historical-data strategy

No legacy product, variant, order, allocation, fulfillment, or delivery rows are
deleted or rewritten. Existing order snapshots and nullable variant references
remain readable. Existing digital units retain their metadata; only new units
are created without a variant association.

## Rollback and safety

Apply the migration only after a production snapshot and a read-only inventory
and order audit. The migration is additive plus trigger/RPC replacement, and
does not run `supabase db reset`. Rollback should restore the previous RPC and
trigger definitions from the repository migration history; do not drop the
new price columns or legacy tables until historical retention is proven.

## Required live verification before release

Run controlled Product A/Product B tests with non-real credentials, verify all
three payment methods consume only the matching product inventory, verify
payment-gated fulfillment and customer isolation, then audit historical orders
and deliveries.
