-- Manual payment instructions are configuration, never hard-coded checkout data.
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS flexy_number TEXT,
  ADD COLUMN IF NOT EXISTS flexy_instructions TEXT,
  ADD COLUMN IF NOT EXISTS ccp_instructions TEXT,
  ADD COLUMN IF NOT EXISTS bank_instructions TEXT,
  ADD COLUMN IF NOT EXISTS telegram_link TEXT;
