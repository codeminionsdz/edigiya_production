-- Digital delivery content is private and server-mediated.
CREATE TABLE IF NOT EXISTS fulfillment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fulfillment_id UUID NOT NULL REFERENCES order_fulfillments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'link', 'code', 'manual')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  object_path TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  url TEXT,
  code TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fulfillment_items_content_check CHECK (
    (type = 'file' AND object_path IS NOT NULL AND original_filename IS NOT NULL AND mime_type IS NOT NULL AND file_size_bytes IS NOT NULL AND url IS NULL AND code IS NULL AND message IS NULL)
    OR (type = 'link' AND url IS NOT NULL AND char_length(btrim(url)) BETWEEN 1 AND 2048 AND object_path IS NULL AND code IS NULL AND message IS NULL)
    OR (type = 'code' AND code IS NOT NULL AND char_length(code) BETWEEN 1 AND 10000 AND object_path IS NULL AND url IS NULL AND message IS NULL)
    OR (type = 'manual' AND message IS NOT NULL AND char_length(message) BETWEEN 1 AND 10000 AND object_path IS NULL AND url IS NULL AND code IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS fulfillment_items_fulfillment_id_idx ON fulfillment_items(fulfillment_id);

ALTER TABLE fulfillment_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE fulfillment_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE fulfillment_items TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-delivery', 'digital-delivery', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE OR REPLACE FUNCTION update_fulfillment_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trigger_update_fulfillment_items_updated_at ON fulfillment_items;
CREATE TRIGGER trigger_update_fulfillment_items_updated_at
BEFORE UPDATE ON fulfillment_items FOR EACH ROW EXECUTE FUNCTION update_fulfillment_items_updated_at();
