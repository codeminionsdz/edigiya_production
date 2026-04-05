-- Customer Profiles table for user information
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (session-based isolation)
CREATE POLICY "customer_profiles_user_isolation" ON customer_profiles
  FOR ALL USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_profiles_session_id ON customer_profiles(session_id);
