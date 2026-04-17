-- Create navbar items table for dynamic navbar management
CREATE TABLE IF NOT EXISTS navbar_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label_ar TEXT NOT NULL,
  label_fr TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  type TEXT DEFAULT 'link', -- 'link', 'category', 'department', 'custom_page'
  target TEXT DEFAULT '_self', -- '_self', '_blank'
  icon_name TEXT,
  parent_id UUID REFERENCES navbar_items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create custom pages table (for pages created by admin)
CREATE TABLE IF NOT EXISTS custom_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title_ar TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  content_ar TEXT,
  content_fr TEXT,
  meta_description_ar TEXT,
  meta_description_fr TEXT,
  meta_keywords TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_navbar_visible BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create junction table for linking products to custom pages
CREATE TABLE IF NOT EXISTS custom_page_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES custom_pages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(page_id, product_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_navbar_items_sort_order ON navbar_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_navbar_items_is_active ON navbar_items(is_active);
CREATE INDEX IF NOT EXISTS idx_navbar_items_parent_id ON navbar_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_custom_pages_is_active ON custom_pages(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_pages_is_navbar_visible ON custom_pages(is_navbar_visible);
CREATE INDEX IF NOT EXISTS idx_custom_page_products_page_id ON custom_page_products(page_id);
CREATE INDEX IF NOT EXISTS idx_custom_page_products_product_id ON custom_page_products(product_id);

-- Create update_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION update_navbar_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_custom_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamp
DROP TRIGGER IF EXISTS trigger_update_navbar_items_updated_at ON navbar_items;
CREATE TRIGGER trigger_update_navbar_items_updated_at
BEFORE UPDATE ON navbar_items
FOR EACH ROW EXECUTE FUNCTION update_navbar_items_updated_at();

DROP TRIGGER IF EXISTS trigger_update_custom_pages_updated_at ON custom_pages;
CREATE TRIGGER trigger_update_custom_pages_updated_at
BEFORE UPDATE ON custom_pages
FOR EACH ROW EXECUTE FUNCTION update_custom_pages_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE navbar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_pages ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
-- Allow admins to manage navbar items and custom pages
-- You can further restrict this by adding authentication checks
DROP POLICY IF EXISTS navbar_items_select_policy ON navbar_items;
DROP POLICY IF EXISTS navbar_items_insert_policy ON navbar_items;
DROP POLICY IF EXISTS navbar_items_update_policy ON navbar_items;
DROP POLICY IF EXISTS navbar_items_delete_policy ON navbar_items;

CREATE POLICY navbar_items_select_policy ON navbar_items
  FOR SELECT USING (true);

CREATE POLICY navbar_items_insert_policy ON navbar_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY navbar_items_update_policy ON navbar_items
  FOR UPDATE USING (true);

CREATE POLICY navbar_items_delete_policy ON navbar_items
  FOR DELETE USING (true);

DROP POLICY IF EXISTS custom_pages_select_policy ON custom_pages;
DROP POLICY IF EXISTS custom_pages_insert_policy ON custom_pages;
DROP POLICY IF EXISTS custom_pages_update_policy ON custom_pages;
DROP POLICY IF EXISTS custom_pages_delete_policy ON custom_pages;

CREATE POLICY custom_pages_select_policy ON custom_pages
  FOR SELECT USING (true);

CREATE POLICY custom_pages_insert_policy ON custom_pages
  FOR INSERT WITH CHECK (true);

CREATE POLICY custom_pages_update_policy ON custom_pages
  FOR UPDATE USING (true);

CREATE POLICY custom_pages_delete_policy ON custom_pages
  FOR DELETE USING (true);

-- Enable RLS for custom page products
ALTER TABLE custom_page_products ENABLE ROW LEVEL SECURITY;

-- Create policies for custom page products
DROP POLICY IF EXISTS custom_page_products_select_policy ON custom_page_products;
DROP POLICY IF EXISTS custom_page_products_insert_policy ON custom_page_products;
DROP POLICY IF EXISTS custom_page_products_update_policy ON custom_page_products;
DROP POLICY IF EXISTS custom_page_products_delete_policy ON custom_page_products;

CREATE POLICY custom_page_products_select_policy ON custom_page_products
  FOR SELECT USING (true);

CREATE POLICY custom_page_products_insert_policy ON custom_page_products
  FOR INSERT WITH CHECK (true);

CREATE POLICY custom_page_products_update_policy ON custom_page_products
  FOR UPDATE USING (true);

CREATE POLICY custom_page_products_delete_policy ON custom_page_products
  FOR DELETE USING (true);
