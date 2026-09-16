-- Phase 20260931: provider invoice lifecycle only. No payment is marked paid here.
-- The existing atomic checkout RPC is preserved verbatim except that SlickPay
-- is admitted to the existing payment-method whitelist.
CREATE OR REPLACE FUNCTION public.create_order_payment_atomic(
  p_order_number TEXT, p_checkout_key TEXT, p_session_id UUID, p_status TEXT,
  p_payment_method TEXT, p_subtotal NUMERIC, p_shipping NUMERIC, p_total NUMERIC,
  p_wilaya_code INTEGER, p_delivery_method TEXT, p_address_snapshot JSONB, p_items JSONB
) RETURNS TABLE(order_id UUID, payment_id UUID, order_number TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order_id UUID; v_payment_id UUID; v_existing_session UUID; v_item JSONB; v_product RECORD; v_variant RECORD; v_qty INTEGER; v_unit NUMERIC; v_line NUMERIC; v_subtotal NUMERIC := 0; v_shipping NUMERIC := 0; v_total NUMERIC; v_method TEXT := p_payment_method; v_reservation_id UUID; v_reservation_item_id UUID; v_stock_reserved BOOLEAN;
BEGIN
  SELECT o.id,o.session_id,p.id INTO v_order_id,v_existing_session,v_payment_id FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.checkout_idempotency_key=p_checkout_key;
  IF v_order_id IS NOT NULL THEN IF v_existing_session<>p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF; RETURN QUERY SELECT v_order_id,v_payment_id,(SELECT o.order_number FROM orders o WHERE o.id=v_order_id); RETURN; END IF;
  IF v_method NOT IN ('slickpay','flexy','ccp','bank_transfer') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method<>'digital' THEN RAISE EXCEPTION 'INVALID_DELIVERY_METHOD'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'INVALID_ORDER_ITEMS'; END IF;
  PERFORM release_expired_inventory_reservations();
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id',COALESCE(value->>'variant_id',''),value->>'qty' LOOP
    v_qty:=(v_item->>'qty')::INTEGER; IF v_qty IS NULL OR v_qty<1 OR v_qty>99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    SELECT pr.id,pr.title_fr,pr.price_dzd,pr.stock,pr.inventory_type,pr.is_active INTO v_product FROM products pr WHERE pr.id=(v_item->>'product_id')::UUID FOR UPDATE;
    IF NOT FOUND OR NOT v_product.is_active THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    SELECT o.id,o.session_id,p.id INTO v_order_id,v_existing_session,v_payment_id FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.checkout_idempotency_key=p_checkout_key;
    IF v_order_id IS NOT NULL THEN IF v_existing_session<>p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF; RETURN QUERY SELECT v_order_id,v_payment_id,(SELECT o.order_number FROM orders o WHERE o.id=v_order_id); RETURN; END IF;
    IF NULLIF(v_item->>'variant_id','') IS NOT NULL THEN SELECT pv.id,pv.product_id,pv.price_delta_dzd,pv.stock INTO v_variant FROM product_variants pv WHERE pv.id=(v_item->>'variant_id')::UUID FOR UPDATE; IF NOT FOUND OR v_variant.product_id<>v_product.id THEN RAISE EXCEPTION 'INVALID_VARIANT'; END IF; IF v_variant.stock<v_qty THEN RAISE EXCEPTION 'VARIANT_OUT_OF_STOCK'; END IF; v_unit:=v_product.price_dzd+COALESCE(v_variant.price_delta_dzd,0); ELSE IF v_product.inventory_type='finite' AND v_product.stock<v_qty THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF; v_unit:=v_product.price_dzd; END IF;
    v_line:=v_unit*v_qty; v_subtotal:=v_subtotal+v_line;
  END LOOP;
  v_total:=v_subtotal+v_shipping; IF p_subtotal IS DISTINCT FROM v_subtotal OR p_shipping IS DISTINCT FROM v_shipping OR p_total IS DISTINCT FROM v_total THEN RAISE EXCEPTION 'CHECKOUT_TOTAL_MISMATCH'; END IF;
  INSERT INTO orders(order_number,checkout_idempotency_key,session_id,status,payment_method,subtotal_dzd,shipping_dzd,total_dzd,wilaya_code,delivery_method,address_snapshot) VALUES(p_order_number,p_checkout_key,p_session_id,'pending',v_method,v_subtotal,v_shipping,v_total,NULL,'digital',p_address_snapshot) ON CONFLICT(checkout_idempotency_key) DO NOTHING RETURNING id INTO v_order_id;
  IF v_order_id IS NULL THEN SELECT o.id,o.session_id,p.id INTO v_order_id,v_existing_session,v_payment_id FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.checkout_idempotency_key=p_checkout_key; IF v_existing_session<>p_session_id THEN RAISE EXCEPTION 'INVALID_CHECKOUT_IDEMPOTENCY_KEY'; END IF; RETURN QUERY SELECT v_order_id,v_payment_id,(SELECT o.order_number FROM orders o WHERE o.id=v_order_id); RETURN; END IF;
  INSERT INTO inventory_reservations(order_id) VALUES(v_order_id) RETURNING id INTO v_reservation_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id',COALESCE(value->>'variant_id',''),value->>'qty' LOOP
    v_qty:=(v_item->>'qty')::INTEGER; SELECT pr.id,pr.inventory_type INTO v_product FROM products pr WHERE pr.id=(v_item->>'product_id')::UUID FOR UPDATE;
    IF NULLIF(v_item->>'variant_id','') IS NOT NULL THEN SELECT pv.id,pv.product_id INTO v_variant FROM product_variants pv WHERE pv.id=(v_item->>'variant_id')::UUID FOR UPDATE; UPDATE product_variants SET stock=stock-v_qty,updated_at=now() WHERE id=v_variant.id AND product_id=v_product.id AND stock>=v_qty; IF NOT FOUND THEN RAISE EXCEPTION 'VARIANT_OUT_OF_STOCK'; END IF; v_stock_reserved:=true;
    ELSE v_stock_reserved:=v_product.inventory_type='finite'; IF v_stock_reserved THEN UPDATE products SET stock=stock-v_qty,updated_at=now() WHERE id=v_product.id AND stock>=v_qty; IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK'; END IF; END IF; END IF;
    INSERT INTO inventory_reservation_items(reservation_id,product_id,variant_id,quantity,stock_reserved) VALUES(v_reservation_id,v_product.id,NULLIF(v_item->>'variant_id','')::UUID,v_qty,v_stock_reserved) RETURNING id INTO v_reservation_item_id;
    INSERT INTO inventory_movements(order_id,reservation_id,product_id,variant_id,movement_type,quantity_delta,idempotency_key,metadata) VALUES(v_order_id,v_reservation_id,v_product.id,NULLIF(v_item->>'variant_id','')::UUID,'reserved',-CASE WHEN v_stock_reserved THEN v_qty ELSE 0 END,'reservation:'||v_reservation_id||':item:'||v_reservation_item_id||':reserved',jsonb_build_object('stock_reserved',v_stock_reserved));
  END LOOP;
  INSERT INTO order_items(order_id,product_id,variant_id,title_snapshot,unit_price_dzd,qty,line_total_dzd) SELECT v_order_id,pr.id,pv.id,pr.title_fr,pr.price_dzd+COALESCE(pv.price_delta_dzd,0),(item->>'qty')::INTEGER,(pr.price_dzd+COALESCE(pv.price_delta_dzd,0))*(item->>'qty')::INTEGER FROM jsonb_array_elements(p_items) item JOIN products pr ON pr.id=(item->>'product_id')::UUID LEFT JOIN product_variants pv ON pv.id=NULLIF(item->>'variant_id','')::UUID AND pv.product_id=pr.id;
  INSERT INTO payments(order_id,method,provider,status,amount_dzd,idempotency_key) VALUES(v_order_id,v_method,NULL,'pending',v_total,'checkout:'||p_checkout_key) RETURNING id INTO v_payment_id;
  INSERT INTO payment_events(payment_id,event_type,actor_type,metadata) VALUES(v_payment_id,'payment_created','customer',jsonb_build_object('amount_dzd',v_total,'method',v_method,'reservation_id',v_reservation_id));
  RETURN QUERY SELECT v_order_id,v_payment_id,p_order_number;
END $$;

REVOKE ALL ON FUNCTION public.create_order_payment_atomic(TEXT,TEXT,UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,INTEGER,TEXT,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_payment_atomic(TEXT,TEXT,UUID,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,INTEGER,TEXT,JSONB,JSONB) TO service_role;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_amount_dzd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS provider_checked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.slickpay_invoice_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('processing','created','failed')),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  provider_invoice_id TEXT UNIQUE,
  checkout_url TEXT,
  amount_dzd NUMERIC(10,2) NOT NULL CHECK (amount_dzd >= 0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slickpay_invoice_attempts_status_idx
  ON public.slickpay_invoice_attempts(status, lease_expires_at);
ALTER TABLE public.slickpay_invoice_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.slickpay_invoice_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.slickpay_invoice_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.claim_slickpay_invoice_attempt(
  p_payment_id UUID, p_idempotency_key TEXT, p_amount_dzd NUMERIC
) RETURNS TABLE(attempt_id UUID, status TEXT, lease_token UUID, provider_invoice_id TEXT, checkout_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.slickpay_invoice_attempts%ROWTYPE; v_token UUID := public.uuid_generate_v4();
BEGIN
  IF p_payment_id IS NULL OR p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 OR p_amount_dzd < 0 THEN
    RAISE EXCEPTION 'INVALID_SLICKPAY_ATTEMPT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id = p_payment_id AND method = 'slickpay' AND status = 'pending' AND amount_dzd = p_amount_dzd) THEN
    RAISE EXCEPTION 'SLICKPAY_PAYMENT_NOT_ELIGIBLE';
  END IF;
  INSERT INTO public.slickpay_invoice_attempts(payment_id,idempotency_key,status,lease_token,lease_expires_at,amount_dzd,attempts)
  VALUES (p_payment_id,p_idempotency_key,'processing',v_token,now()+interval '5 minutes',p_amount_dzd,1)
  ON CONFLICT (payment_id) DO NOTHING;
  SELECT * INTO v FROM public.slickpay_invoice_attempts WHERE payment_id = p_payment_id FOR UPDATE;
  IF v.amount_dzd <> p_amount_dzd OR v.idempotency_key <> p_idempotency_key THEN RAISE EXCEPTION 'SLICKPAY_ATTEMPT_MISMATCH'; END IF;
  IF v.status = 'created' THEN
    RETURN QUERY SELECT v.id,v.status,NULL::UUID,v.provider_invoice_id,v.checkout_url; RETURN;
  END IF;
  IF v.status = 'processing' AND v.lease_expires_at > now() AND v.lease_token IS NOT NULL AND v.lease_token <> v_token THEN
    RAISE EXCEPTION 'SLICKPAY_INVOICE_IN_PROGRESS';
  END IF;
  UPDATE public.slickpay_invoice_attempts SET status='processing',lease_token=v_token,lease_expires_at=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() WHERE id=v.id;
  RETURN QUERY SELECT v.id,'processing',v_token,NULL::TEXT,NULL::TEXT;
END $$;

CREATE OR REPLACE FUNCTION public.complete_slickpay_invoice_attempt(
  p_attempt_id UUID, p_lease_token UUID, p_provider_invoice_id TEXT, p_checkout_url TEXT
) RETURNS TABLE(status TEXT, provider_invoice_id TEXT, checkout_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.slickpay_invoice_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.slickpay_invoice_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v.status <> 'processing' OR v.lease_token IS DISTINCT FROM p_lease_token OR v.lease_expires_at < now() THEN RAISE EXCEPTION 'SLICKPAY_ATTEMPT_NOT_OWNED'; END IF;
  IF p_provider_invoice_id IS NULL OR p_checkout_url IS NULL OR p_checkout_url !~ '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'INVALID_SLICKPAY_INVOICE'; END IF;
  UPDATE public.slickpay_invoice_attempts SET status='created',provider_invoice_id=p_provider_invoice_id,checkout_url=p_checkout_url,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=v.id;
  UPDATE public.payments SET provider='slickpay',provider_reference=p_provider_invoice_id,provider_checkout_url=p_checkout_url,provider_amount_dzd=v.amount_dzd,provider_status='created' WHERE id=v.payment_id AND status='pending' AND amount_dzd=v.amount_dzd;
  RETURN QUERY SELECT 'created',p_provider_invoice_id,p_checkout_url;
END $$;

CREATE OR REPLACE FUNCTION public.fail_slickpay_invoice_attempt(
  p_attempt_id UUID, p_lease_token UUID, p_error TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.slickpay_invoice_attempts SET status='failed',last_error=left(coalesce(p_error,'provider_error'),500),lease_token=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE id=p_attempt_id AND status='processing' AND lease_token=p_lease_token;
END $$;

CREATE OR REPLACE FUNCTION public.record_slickpay_verification_atomic(
  p_payment_id UUID, p_provider_invoice_id TEXT, p_completed BOOLEAN, p_provider_status TEXT, p_provider_amount NUMERIC
) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.payments WHERE id=p_payment_id AND method='slickpay' AND provider_reference=p_provider_invoice_id FOR UPDATE;
  IF NOT FOUND OR p_provider_amount IS NULL OR p_provider_amount <> v.amount_dzd THEN RAISE EXCEPTION 'SLICKPAY_PAYMENT_MISMATCH'; END IF;
  UPDATE public.payments SET provider_status=left(coalesce(p_provider_status,CASE WHEN p_completed THEN 'completed' ELSE 'pending' END),100),provider_amount_dzd=p_provider_amount,provider_checked_at=now(),status=CASE WHEN p_completed AND status='pending' THEN 'paid' ELSE status END,verified_at=CASE WHEN p_completed AND status='pending' THEN now() ELSE verified_at END,verified_by=CASE WHEN p_completed AND status='pending' THEN 'slickpay' ELSE verified_by END WHERE id=v.id RETURNING * INTO v;
  IF p_completed AND NOT EXISTS (SELECT 1 FROM public.payment_events WHERE payment_id=v.id AND event_type='payment_verified' AND actor_type='provider' AND metadata->>'provider_invoice_id'=p_provider_invoice_id) THEN
    INSERT INTO public.payment_events(payment_id,event_type,actor_type,metadata) VALUES (v.id,'payment_verified','provider',jsonb_build_object('provider','slickpay','provider_invoice_id',p_provider_invoice_id,'amount_dzd',p_provider_amount));
  END IF;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.claim_slickpay_invoice_attempt(UUID,TEXT,NUMERIC) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_slickpay_invoice_attempt(UUID,TEXT,NUMERIC) TO service_role;
REVOKE ALL ON FUNCTION public.complete_slickpay_invoice_attempt(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_slickpay_invoice_attempt(UUID,UUID,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.fail_slickpay_invoice_attempt(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_slickpay_invoice_attempt(UUID,UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.record_slickpay_verification_atomic(UUID,TEXT,BOOLEAN,TEXT,NUMERIC) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_slickpay_verification_atomic(UUID,TEXT,BOOLEAN,TEXT,NUMERIC) TO service_role;
