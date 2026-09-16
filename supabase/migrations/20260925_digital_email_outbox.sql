-- Phase 2: durable digital-delivery email outbox foundation.
-- No provider is configured here and no email is sent by this migration.

CREATE TABLE IF NOT EXISTS public.digital_email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE RESTRICT,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL
    CHECK (email_type IN ('guest_digital_delivery', 'account_digital_delivery')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digital_email_outbox_payload_safe CHECK (
    NOT (payload ?| ARRAY[
      'secret', 'decrypted_secret', 'password', 'credential', 'credentials',
      'code', 'vault_secret_id', 'guest_token', 'delivery_token', 'token'
    ])
  )
);

CREATE INDEX IF NOT EXISTS digital_email_outbox_ready_idx
  ON public.digital_email_outbox(status, available_at, created_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS digital_email_outbox_order_idx
  ON public.digital_email_outbox(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_email_outbox_type_status_idx
  ON public.digital_email_outbox(email_type, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_digital_email_outbox_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_digital_email_outbox_updated_at
  ON public.digital_email_outbox;
CREATE TRIGGER trigger_update_digital_email_outbox_updated_at
BEFORE UPDATE ON public.digital_email_outbox
FOR EACH ROW
EXECUTE FUNCTION public.update_digital_email_outbox_updated_at();

ALTER TABLE public.digital_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.digital_email_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.digital_email_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_digital_delivery_email(
  p_order_id UUID,
  p_order_item_id UUID,
  p_email_type TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE(outbox_id UUID, outbox_status TEXT, recipient_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_existing public.digital_email_outbox%ROWTYPE;
  v_email TEXT;
  v_is_account BOOLEAN;
  v_payload JSONB;
BEGIN
  IF p_order_id IS NULL
     OR p_email_type NOT IN ('guest_digital_delivery', 'account_digital_delivery')
     OR p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_EMAIL_OUTBOX_INPUT';
  END IF;

  SELECT o.id, o.session_id, o.delivery_method, o.address_snapshot
    INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;
  IF NOT FOUND OR v_order.delivery_method <> 'digital' THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_ORDER_NOT_ELIGIBLE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payments AS p
    WHERE p.order_id = p_order_id AND p.status = 'paid'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.order_fulfillments AS f
    WHERE f.order_id = p_order_id AND f.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_DELIVERY_NOT_READY';
  END IF;

  IF p_order_item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.order_items AS oi
      WHERE oi.id = p_order_item_id AND oi.order_id = p_order_id
    ) THEN
      RAISE EXCEPTION 'DIGITAL_EMAIL_ORDER_ITEM_MISMATCH';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.digital_fulfillment_allocations AS dfa
      JOIN public.order_fulfillments AS f ON f.id = dfa.fulfillment_id
      WHERE dfa.order_id = p_order_id
        AND dfa.order_item_id = p_order_item_id
        AND dfa.status = 'delivered'
        AND f.order_id = p_order_id
        AND f.status = 'delivered'
    ) THEN
      RAISE EXCEPTION 'DIGITAL_EMAIL_ITEM_NOT_DELIVERED';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.digital_fulfillment_allocations AS dfa
    WHERE dfa.order_id = p_order_id AND dfa.status = 'delivered'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.fulfillment_items AS fi
    JOIN public.order_fulfillments AS f ON f.id = fi.fulfillment_id
    WHERE f.order_id = p_order_id AND f.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_CONTENT_NOT_DELIVERED';
  END IF;

  v_email := lower(btrim(v_order.address_snapshot->>'email'));
  IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_RECIPIENT_INVALID';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.customer_profiles AS cp
    WHERE cp.session_id = v_order.session_id
      AND cp.password_hash IS NOT NULL
      AND cp.password_salt IS NOT NULL
  ) INTO v_is_account;

  IF (p_email_type = 'account_digital_delivery') IS DISTINCT FROM v_is_account THEN
    RAISE EXCEPTION 'DIGITAL_EMAIL_CUSTOMER_TYPE_MISMATCH';
  END IF;

  SELECT e.* INTO v_existing
  FROM public.digital_email_outbox AS e
  WHERE e.idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.order_id IS DISTINCT FROM p_order_id
       OR v_existing.order_item_id IS DISTINCT FROM p_order_item_id
       OR v_existing.email_type IS DISTINCT FROM p_email_type THEN
      RAISE EXCEPTION 'DIGITAL_EMAIL_IDEMPOTENCY_MISMATCH';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.status, v_existing.recipient_email;
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'delivery_mode', CASE WHEN v_is_account THEN 'account_library' ELSE 'guest_grant' END,
    'requires_secure_delivery', TRUE,
    'order_id', p_order_id,
    'order_item_id', p_order_item_id
  );

  INSERT INTO public.digital_email_outbox(
    order_id, order_item_id, recipient_email, email_type,
    payload, idempotency_key
  ) VALUES (
    p_order_id, p_order_item_id, v_email, p_email_type,
    v_payload, p_idempotency_key
  )
  RETURNING id, status, recipient_email
  INTO outbox_id, outbox_status, recipient_email;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_digital_email_outbox_job(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE(
  outbox_id UUID,
  order_id UUID,
  order_item_id UUID,
  recipient_email TEXT,
  email_type TEXT,
  payload JSONB,
  attempt_count INTEGER,
  lease_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.digital_email_outbox%ROWTYPE;
  v_token UUID := uuid_generate_v4();
BEGIN
  IF p_worker_id IS NULL OR length(btrim(p_worker_id)) = 0
     OR p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_EMAIL_WORKER';
  END IF;

  SELECT e.* INTO v_job
  FROM public.digital_email_outbox AS e
  WHERE e.status IN ('pending', 'failed')
    AND e.available_at <= now()
  ORDER BY e.created_at, e.id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.digital_email_outbox AS e
  SET status = 'processing',
      attempt_count = e.attempt_count + 1,
      lease_token = v_token,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      last_error = NULL
  WHERE e.id = v_job.id
  RETURNING e.* INTO v_job;

  RETURN QUERY SELECT v_job.id, v_job.order_id, v_job.order_item_id,
    v_job.recipient_email, v_job.email_type, v_job.payload,
    v_job.attempt_count, v_job.lease_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_digital_email_outbox_sent(
  p_outbox_id UUID,
  p_lease_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.digital_email_outbox
  SET status = 'sent', sent_at = now(), lease_token = NULL, lease_until = NULL
  WHERE id = p_outbox_id
    AND status = 'processing'
    AND lease_token = p_lease_token
    AND (lease_until IS NULL OR lease_until > now());
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_digital_email_outbox_failed(
  p_outbox_id UUID,
  p_lease_token UUID,
  p_error TEXT,
  p_retry_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.digital_email_outbox
  SET status = 'failed',
      last_error = left(COALESCE(NULLIF(btrim(p_error), ''), 'EMAIL_DELIVERY_FAILED'), 1000),
      available_at = COALESCE(p_retry_at, now() + interval '15 minutes'),
      lease_token = NULL,
      lease_until = NULL
  WHERE id = p_outbox_id
    AND status = 'processing'
    AND lease_token = p_lease_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_digital_delivery_email(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_digital_delivery_email(UUID, UUID, TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.claim_digital_email_outbox_job(TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_digital_email_outbox_job(TEXT, INTEGER)
  TO service_role;
REVOKE ALL ON FUNCTION public.mark_digital_email_outbox_sent(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_digital_email_outbox_sent(UUID, UUID)
  TO service_role;
REVOKE ALL ON FUNCTION public.mark_digital_email_outbox_failed(UUID, UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_digital_email_outbox_failed(UUID, UUID, TEXT, TIMESTAMPTZ)
  TO service_role;
REVOKE ALL ON FUNCTION public.update_digital_email_outbox_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
