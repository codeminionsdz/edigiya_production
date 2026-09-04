-- Atomic, server-mediated Admin payment transitions.
-- The application verifies the Admin session before calling this service-role RPC.
CREATE OR REPLACE FUNCTION admin_transition_payment_atomic(
  p_payment_id UUID,
  p_target_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_actor_id TEXT DEFAULT 'admin'
)
RETURNS payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment payments;
  v_event_type TEXT;
  v_clean_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF p_target_status NOT IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_TRANSITION';
  END IF;
  IF p_target_status = 'rejected' AND v_clean_note IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;

  UPDATE payments
  SET status = p_target_status,
      verified_at = CASE WHEN p_target_status = 'paid' THEN now() ELSE verified_at END,
      verified_by = p_actor_id,
      verification_note = CASE WHEN p_target_status = 'paid' THEN v_clean_note ELSE verification_note END,
      failure_reason = CASE WHEN p_target_status = 'rejected' THEN v_clean_note ELSE failure_reason END
  WHERE id = p_payment_id
    AND status IN ('pending', 'verification_required')
  RETURNING * INTO v_payment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_STATE_CONFLICT';
  END IF;

  v_event_type := CASE WHEN p_target_status = 'paid' THEN 'payment_verified' ELSE 'payment_rejected' END;
  INSERT INTO payment_events(payment_id, event_type, actor_type, actor_id, metadata)
  VALUES (v_payment.id, v_event_type, 'admin', p_actor_id,
          jsonb_build_object('note', v_clean_note));
  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION admin_transition_payment_atomic(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_transition_payment_atomic(UUID, TEXT, TEXT, TEXT) TO service_role;
