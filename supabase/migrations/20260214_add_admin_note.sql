-- Add admin_note column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;
