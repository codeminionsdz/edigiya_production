-- Add authentication fields for customer login/register
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_salt TEXT;

-- Speeds up account lookup during login
CREATE INDEX IF NOT EXISTS idx_customer_profiles_email_lower
  ON customer_profiles (LOWER(email));
