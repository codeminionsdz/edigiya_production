-- Phase 2: narrow server-only delivery read boundary.
--
-- This function is deliberately bound to the existing signed customer session,
-- order, allocation, paid payment, and delivered fulfillment. It does not
-- accept a Vault UUID and it exposes no generic Vault lookup.

CREATE OR REPLACE FUNCTION public.get_digital_unit_secret_for_session(
  p_order_id UUID,
  p_allocation_id UUID,
  p_session_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  IF p_order_id IS NULL OR p_allocation_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  SELECT ds.decrypted_secret
    INTO v_secret
  FROM public.orders AS o
  JOIN public.order_items AS oi
    ON oi.order_id = o.id
  JOIN public.payments AS p
    ON p.order_id = o.id
   AND p.status = 'paid'
  JOIN public.order_fulfillments AS f
    ON f.order_id = o.id
   AND f.status = 'delivered'
  JOIN public.digital_unit_allocations AS a
    ON a.id = p_allocation_id
   AND a.order_id = o.id
   AND a.order_item_id = oi.id
   AND a.status IN ('allocated', 'consumed')
  JOIN public.digital_inventory_units AS u
    ON u.id = a.digital_inventory_unit_id
   AND u.product_id = a.product_id
   AND u.status IN ('allocated', 'consumed')
  JOIN public.digital_unit_secret_versions AS sv
    ON sv.digital_inventory_unit_id = u.id
   AND sv.status = 'current'
   AND sv.version_no = u.secret_version
   AND sv.vault_secret_id = u.vault_secret_id
  JOIN vault.decrypted_secrets AS ds
    ON ds.id = sv.vault_secret_id
  WHERE o.id = p_order_id
    AND o.session_id = p_session_id
    AND o.delivery_method = 'digital'
    AND a.product_id = oi.product_id
    AND a.variant_id IS NOT DISTINCT FROM oi.variant_id
    AND u.variant_id IS NOT DISTINCT FROM a.variant_id;

  IF NOT FOUND OR v_secret IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_DELIVERY_NOT_AUTHORIZED';
  END IF;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_digital_unit_secret_for_session(UUID, UUID, UUID)
  TO service_role;
