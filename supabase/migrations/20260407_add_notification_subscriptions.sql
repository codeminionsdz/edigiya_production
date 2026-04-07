-- Add notification subscriptions table
CREATE TABLE IF NOT EXISTS admin_notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id TEXT NOT NULL,
  subscription_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  device_info JSONB
);

-- Add index for quick lookups
CREATE INDEX idx_admin_subscriptions_admin_id ON admin_notification_subscriptions(admin_id);
CREATE INDEX idx_admin_subscriptions_active ON admin_notification_subscriptions(is_active);

-- Enable RLS
ALTER TABLE admin_notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow admin operations
CREATE POLICY "admin_subscriptions_insert" ON admin_notification_subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "admin_subscriptions_select" ON admin_notification_subscriptions
  FOR SELECT
  USING (true);

CREATE POLICY "admin_subscriptions_update" ON admin_notification_subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admin_subscriptions_delete" ON admin_notification_subscriptions
  FOR DELETE
  USING (true);
