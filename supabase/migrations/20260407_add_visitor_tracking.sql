-- Add visitor tracking table
CREATE TABLE IF NOT EXISTS site_visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for quick lookups
CREATE INDEX idx_site_visitors_timestamp ON site_visitors(timestamp DESC);
CREATE INDEX idx_site_visitors_session ON site_visitors(session_id);

-- Enable RLS
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for tracking)
CREATE POLICY "site_visitors_insert_public" ON site_visitors
  FOR INSERT
  WITH CHECK (true);

-- Allow public reads for recent visitors
CREATE POLICY "site_visitors_read_public" ON site_visitors
  FOR SELECT
  USING (true);
