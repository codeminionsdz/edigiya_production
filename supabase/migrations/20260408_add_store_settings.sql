-- Add persistent store settings table
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_name TEXT NOT NULL,
  description TEXT,
  contact_email TEXT,
  phone_primary TEXT,
  phone_secondary TEXT,
  whatsapp TEXT,
  address TEXT,
  map_link TEXT,
  map_embed TEXT,
  working_hours TEXT,
  facebook TEXT,
  instagram TEXT,
  tiktok TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_settings_updated_at ON store_settings(updated_at);

CREATE OR REPLACE FUNCTION update_store_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_store_settings_updated_at ON store_settings;
CREATE TRIGGER trigger_update_store_settings_updated_at
BEFORE UPDATE ON store_settings
FOR EACH ROW EXECUTE FUNCTION update_store_settings_updated_at();
