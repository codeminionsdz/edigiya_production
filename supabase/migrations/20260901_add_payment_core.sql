-- Additive payment core for manual payment verification and future providers.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('slickpay', 'flexy', 'ccp', 'bank_transfer', 'cod', 'cib', 'edahabia', 'bank')),
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verification_required', 'paid', 'failed', 'rejected', 'cancelled')),
  amount_dzd DECIMAL(10,2) NOT NULL CHECK (amount_dzd >= 0),
  currency TEXT NOT NULL DEFAULT 'DZD',
  provider_reference TEXT,
  proof_object_path TEXT,
  verification_note TEXT,
  failure_reason TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_active_per_order
  ON payments(order_id)
  WHERE status NOT IN ('failed', 'rejected', 'cancelled');
CREATE INDEX IF NOT EXISTS payments_provider_reference_idx ON payments(provider_reference);
CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments(order_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('payment_created', 'proof_uploaded', 'verification_required', 'payment_verified', 'payment_rejected', 'payment_failed', 'payment_cancelled', 'provider_callback_received')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system', 'provider')),
  actor_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_payment_id_idx ON payment_events(payment_id);

CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payments_updated_at ON payments;
CREATE TRIGGER trigger_update_payments_updated_at
BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_payments_updated_at();

-- Proofs are private. Server actions use the service role and ownership checks.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

