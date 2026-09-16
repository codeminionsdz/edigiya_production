-- Direct product-only secret access, independent from variants and allocations.
CREATE OR REPLACE FUNCTION public.get_direct_product_unit_secret(
  p_order_id UUID,
  p_order_item_id UUID,
  p_unit_id UUID,
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
  SELECT ds.decrypted_secret INTO v_secret
  FROM public.orders AS o
  JOIN public.payments AS p ON p.order_id = o.id AND p.status = 'paid'
  JOIN public.digital_deliveries AS d ON d.order_id = o.id AND d.status = 'delivered'
  JOIN public.order_fulfillments AS f ON f.order_id = o.id AND f.status = 'delivered'
  JOIN public.order_items AS oi ON oi.id = p_order_item_id AND oi.order_id = o.id
  JOIN public.digital_inventory_units AS u
    ON u.id = p_unit_id AND u.order_item_id = oi.id AND u.status = 'sold'
  JOIN public.digital_unit_secret_versions AS sv
    ON sv.digital_inventory_unit_id = u.id
   AND sv.status = 'current'
   AND sv.version_no = u.secret_version
   AND sv.vault_secret_id = u.vault_secret_id
  JOIN vault.decrypted_secrets AS ds ON ds.id = sv.vault_secret_id
  WHERE o.id = p_order_id AND o.session_id = p_session_id;

  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE EXCEPTION 'DIGITAL_SECRET_UNAVAILABLE';
  END IF;

  UPDATE public.digital_access AS da
  SET last_accessed_at = now()
  WHERE da.order_id = p_order_id AND da.order_item_id = p_order_item_id;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_direct_product_unit_secret(UUID, UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_direct_product_unit_secret(UUID, UUID, UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_direct_product_item_secrets(
  p_order_id UUID,
  p_order_item_id UUID,
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
  SELECT string_agg(ds.decrypted_secret, E'\n\n' ORDER BY u.created_at, u.id)
    INTO v_secret
  FROM public.orders AS o
  JOIN public.payments AS p ON p.order_id = o.id AND p.status = 'paid'
  JOIN public.digital_deliveries AS d ON d.order_id = o.id AND d.status = 'delivered'
  JOIN public.order_fulfillments AS f ON f.order_id = o.id AND f.status = 'delivered'
  JOIN public.order_items AS oi ON oi.id = p_order_item_id AND oi.order_id = o.id
  JOIN public.digital_inventory_units AS u
    ON u.order_item_id = oi.id AND u.status = 'sold'
  JOIN public.digital_unit_secret_versions AS sv
    ON sv.digital_inventory_unit_id = u.id
   AND sv.status = 'current'
   AND sv.version_no = u.secret_version
   AND sv.vault_secret_id = u.vault_secret_id
  JOIN vault.decrypted_secrets AS ds ON ds.id = sv.vault_secret_id
  WHERE o.id = p_order_id AND o.session_id = p_session_id;

  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE EXCEPTION 'DIGITAL_SECRET_UNAVAILABLE';
  END IF;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_direct_product_item_secrets(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_direct_product_item_secrets(UUID, UUID, UUID)
  TO service_role;
