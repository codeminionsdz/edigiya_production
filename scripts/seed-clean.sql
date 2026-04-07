-- Clean, idempotent seed script for ComputerHouse
-- All INSERT statements use ON CONFLICT with valid constraints

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

INSERT INTO departments (slug, name_fr, name_ar, icon, sort_order, is_active)
VALUES 
  ('informatique', 'Informatique', 'علوم الحاسب', 'laptop', 1, true),
  ('electronique', 'Electronique', 'الالكترونيات', 'smartphone', 2, true),
  ('peripheriques', 'Peripheriques', 'ملحقات', 'mouse', 3, true),
  ('accessoires', 'Accessoires', 'ملحقات', 'headphones', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- BRANDS
-- ============================================================================

INSERT INTO brands (name, slug, logo_url, is_active)
VALUES 
  ('ASUS', 'asus', 'https://asus.com/logo.png', true),
  ('MSI', 'msi', 'https://msi.com/logo.png', true),
  ('Intel', 'intel', 'https://intel.com/logo.png', true),
  ('AMD', 'amd', 'https://amd.com/logo.png', true),
  ('NVIDIA', 'nvidia', 'https://nvidia.com/logo.png', true),
  ('Corsair', 'corsair', 'https://corsair.com/logo.png', true),
  ('Samsung', 'samsung', 'https://samsung.com/logo.png', true),
  ('LG', 'lg', 'https://lg.com/logo.png', true),
  ('Logitech', 'logitech', 'https://logitech.com/logo.png', true),
  ('Kingston', 'kingston', 'https://kingston.com/logo.png', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- CATEGORIES (using composite unique: department_id, parent_id, slug)
-- ============================================================================

INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'ordinateurs-portables', 'Ordinateurs Portables', 'اجهزة كمبيوتر محمول', 1, true
FROM departments WHERE slug = 'informatique'
WHERE NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.department_id = (SELECT id FROM departments WHERE slug = 'informatique')
  AND c.parent_id IS NULL 
  AND c.slug = 'ordinateurs-portables'
);

INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'ordinateurs-de-bureau', 'Ordinateurs de Bureau', 'اجهزة كمبيوتر مكتبية', 2, true
FROM departments WHERE slug = 'informatique'
WHERE NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.department_id = (SELECT id FROM departments WHERE slug = 'informatique')
  AND c.parent_id IS NULL 
  AND c.slug = 'ordinateurs-de-bureau'
);

INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'ecrans', 'Ecrans', 'شاشات', 1, true
FROM departments WHERE slug = 'electronique'
WHERE NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.department_id = (SELECT id FROM departments WHERE slug = 'electronique')
  AND c.parent_id IS NULL 
  AND c.slug = 'ecrans'
);

INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'stockage', 'Stockage', 'التخزين', 2, true
FROM departments WHERE slug = 'electronique'
WHERE NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.department_id = (SELECT id FROM departments WHERE slug = 'electronique')
  AND c.parent_id IS NULL 
  AND c.slug = 'stockage'
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================

INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'asus-rog-strix-g16',
  'ASUS ROG Strix G16',
  'ASUS ROG Strix G16',
  'Gaming laptop haute performance avec ecran 16 pouces 240Hz',
  'جهاز كمبيوتر محمول للالعاب عالي الاداء مع شاشة 16 بوصة بسرعة 240 هرتز',
  (SELECT id FROM brands WHERE slug = 'asus'),
  (SELECT id FROM departments WHERE slug = 'informatique'),
  (SELECT id FROM categories WHERE slug = 'ordinateurs-portables'),
  289000,
  349000,
  'ASUS-ROG-G16-001',
  5,
  true,
  true,
  1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'asus-rog-strix-g16');

INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'msi-katana-15',
  'MSI Katana 15',
  'MSI Katana 15',
  'Ordinateur portable gaming avec RTX 4060, ecran 144Hz',
  'جهاز كمبيوتر محمول للالعاب مع RTX 4060 وشاشة 144 هرتز',
  (SELECT id FROM brands WHERE slug = 'msi'),
  (SELECT id FROM departments WHERE slug = 'informatique'),
  (SELECT id FROM categories WHERE slug = 'ordinateurs-portables'),
  215000,
  259000,
  'MSI-KATANA-15-001',
  3,
  true,
  true,
  2
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'msi-katana-15');

INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'lg-ultragear-27gp850',
  'LG UltraGear 27GP850-B',
  'LG UltraGear 27GP850-B',
  'Ecran gaming 27 pouces 240Hz, 1ms IPS',
  'شاشة العاب 27 بوصة 240 هرتز 1 ميلي ثانية IPS',
  (SELECT id FROM brands WHERE slug = 'lg'),
  (SELECT id FROM departments WHERE slug = 'electronique'),
  (SELECT id FROM categories WHERE slug = 'ecrans'),
  89000,
  109000,
  'LG-27GP850-001',
  8,
  true,
  true,
  1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'lg-ultragear-27gp850');

INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'samsung-990-pro-2tb',
  'Samsung 990 PRO 2To',
  'Samsung 990 PRO 2To',
  'SSD NVMe ultra-rapide 7100 MB/s',
  'محرك اقراص SSD NVMe فائق السرعة 7100 ميجابايت / ثانية',
  (SELECT id FROM brands WHERE slug = 'samsung'),
  (SELECT id FROM departments WHERE slug = 'electronique'),
  (SELECT id FROM categories WHERE slug = 'stockage'),
  45000,
  54000,
  'SAMSUNG-990-PRO-2TB',
  12,
  true,
  true,
  1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'samsung-990-pro-2tb');

INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'logitech-g502-x-plus',
  'Logitech G502 X PLUS',
  'Logitech G502 X PLUS',
  'Souris gaming sans fil avec capteur HERO 25K',
  'ماوس العاب لاسلكي مع محس HERO 25K',
  (SELECT id FROM brands WHERE slug = 'logitech'),
  (SELECT id FROM departments WHERE slug = 'peripheriques'),
  (SELECT id FROM categories WHERE slug = 'ordinateurs-portables'),
  32000,
  39000,
  'LOGITECH-G502-PLUS',
  20,
  true,
  true,
  1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'logitech-g502-x-plus');

-- ============================================================================
-- SHIPPING RULES
-- ============================================================================

DELETE FROM shipping_rules WHERE id IS NOT NULL;

INSERT INTO shipping_rules (free_shipping_threshold_dzd, default_fee_dzd)
VALUES (50000, 500);

-- ============================================================================
-- VERIFY SEED
-- ============================================================================

SELECT 
  (SELECT COUNT(*) FROM departments) as dept_count,
  (SELECT COUNT(*) FROM categories) as cat_count,
  (SELECT COUNT(*) FROM brands) as brand_count,
  (SELECT COUNT(*) FROM products) as product_count,
  (SELECT COUNT(*) FROM shipping_rules) as rules_count;
