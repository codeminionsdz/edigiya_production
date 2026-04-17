-- Create junction table for products to categories (Many-to-Many)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- Create junction table for products to departments (Many-to-Many)
CREATE TABLE IF NOT EXISTS product_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, department_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_departments_product_id ON product_departments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_departments_department_id ON product_departments(department_id);

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_departments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_categories
CREATE POLICY "Anyone can read product_categories" 
  ON product_categories FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert product_categories" 
  ON product_categories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can delete product_categories" 
  ON product_categories FOR DELETE
  USING (true);

-- Create RLS policies for product_departments
CREATE POLICY "Anyone can read product_departments" 
  ON product_departments FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert product_departments" 
  ON product_departments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can delete product_departments" 
  ON product_departments FOR DELETE
  USING (true);
