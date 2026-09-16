-- Keep a paid digital order eligible for its atomic allocation retry.
-- This only extends an existing order reservation; it does not create stock,
-- units, Vault secrets, or a second reservation.

CREATE OR REPLACE FUNCTION public.refresh_digital_reservation_for_paid_order(
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paid BOOLEAN;
  v_digital BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.payments
    WHERE public.payments.order_id = p_order_id AND status = 'paid'
  ) INTO v_paid;

  SELECT EXISTS (
    SELECT 1
    FROM public.orders AS o
    JOIN public.order_items AS oi ON oi.order_id = o.id
    JOIN public.products AS pr ON pr.id = oi.product_id
    WHERE o.id = p_order_id
      AND o.delivery_method = 'digital'
      AND pr.fulfillment_type IN ('credentials', 'code')
  ) INTO v_digital;

  IF NOT v_paid OR NOT v_digital THEN
    RETURN FALSE;
  END IF;

  UPDATE public.inventory_reservations
  SET expires_at = GREATEST(expires_at, now() + interval '30 minutes')
  WHERE public.inventory_reservations.order_id = p_order_id
    AND status = 'active';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_digital_reservation_for_paid_order(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_digital_reservation_for_paid_order(UUID)
  TO service_role;
