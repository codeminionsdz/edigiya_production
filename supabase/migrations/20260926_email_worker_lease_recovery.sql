-- Phase 2: provider-agnostic email worker lease recovery.
-- No provider credentials or email delivery are configured here.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  v_token UUID := gen_random_uuid();
BEGIN
  IF p_worker_id IS NULL OR length(btrim(p_worker_id)) = 0
     OR p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'INVALID_DIGITAL_EMAIL_WORKER';
  END IF;

  SELECT e.* INTO v_job
  FROM public.digital_email_outbox AS e
  WHERE (
    e.status IN ('pending', 'failed') AND e.available_at <= now()
  ) OR (
    e.status = 'processing' AND e.lease_until IS NOT NULL AND e.lease_until <= now()
  )
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

REVOKE ALL ON FUNCTION public.claim_digital_email_outbox_job(TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_digital_email_outbox_job(TEXT, INTEGER)
  TO service_role;
