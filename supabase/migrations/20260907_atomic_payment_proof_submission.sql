-- Keep the payment proof database transition and its audit events atomic.
CREATE OR REPLACE FUNCTION submit_payment_proof_atomic(
  p_payment_id UUID,
  p_order_id UUID,
  p_session_id UUID,
  p_proof_object_path TEXT,
  p_provider_reference TEXT DEFAULT NULL
)
RETURNS payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment payments;
  v_reference TEXT := NULLIF(btrim(COALESCE(p_provider_reference, '')), '');
BEGIN
  UPDATE payments p
  SET status = 'verification_required',
      proof_object_path = p_proof_object_path,
      provider_reference = v_reference,
      verification_note = NULL
  FROM orders o
  WHERE p.id = p_payment_id
    AND p.order_id = p_order_id
    AND o.id = p.order_id
    AND o.session_id = p_session_id
    AND (
      p.status IN ('pending', 'rejected')
      OR (p.status = 'verification_required' AND p.proof_object_path IS NULL)
    )
  RETURNING p.* INTO v_payment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_STATE_CONFLICT';
  END IF;

  INSERT INTO payment_events(payment_id, event_type, actor_type, metadata)
  VALUES
    (v_payment.id, 'proof_uploaded', 'customer', jsonb_build_object(
      'object_path', p_proof_object_path,
      'order_id', p_order_id
    )),
    (v_payment.id, 'verification_required', 'customer', jsonb_build_object(
      'order_id', p_order_id
    ));

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION submit_payment_proof_atomic(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_payment_proof_atomic(UUID, UUID, UUID, TEXT, TEXT) TO service_role;
