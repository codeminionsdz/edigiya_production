-- Product-only delivery sends one email containing all delivered units.
-- Remove duplicate queued rows left by the previous item-by-item flow.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY order_id ORDER BY created_at, id) AS rn
  FROM public.digital_email_outbox
  WHERE email_type IN ('guest_digital_delivery', 'account_digital_delivery')
)
DELETE FROM public.digital_email_outbox AS e
USING ranked AS r
WHERE e.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS digital_email_outbox_one_product_email_per_order
  ON public.digital_email_outbox(order_id)
  WHERE email_type IN ('guest_digital_delivery', 'account_digital_delivery');

NOTIFY pgrst, 'reload schema';
