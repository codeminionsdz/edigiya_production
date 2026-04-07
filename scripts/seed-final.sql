-- Clean, idempotent seed script for ComputerHouse
-- Uses only UTF-8 safe characters and valid constraint syntax

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

INSERT INTO departments (slug, name_fr, name_ar, icon, sort_order, is_active)
VALUES 
  ('informatique', 'Informatique', 'علوم الحاسب', 'laptop', 1, true),
  ('electronique', 'Electronique', 'الالكترونيات', 'smartphone', 2, true),
  ('peripheriques', 'Peripheriques', 'ملحقات', 'mouse', 3, true),
  ('accessoires', 'Accessoires', 'اكسسوارات', 'headphones', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- BRANDS
-- ============================================================================

INSERT INTO brands (name, slug, logo_url, is_active)
VALUES 
  ('ASUS', 'asus', 'https://via.placeholder.com/100?text=ASUS', true),
  ('MSI', 'msi', 'https://via.placeholder.com/100?text=MSI', true),
  ('Intel', 'intel', 'https://via.placeholder.com/100?text=Intel', true),
  ('AMD', 'amd', 'https://via.placeholder.com/100?text=AMD', true),
  ('NVIDIA', 'nvidia', 'https://via.placeholder.com/100?text=NVIDIA', true),
  ('Corsair', 'corsair', 'https://via.placeholder.com/100?text=Corsair', true),
  ('Samsung', 'samsung', 'https://via.placeholder.com/100?text=Samsung', true),
  ('LG', 'lg', 'https://via.placeholder.com/100?text=LG', true),
  ('Logitech', 'logitech', 'https://via.placeholder.com/100?text=Logitech', true),
  ('Kingston', 'kingston', 'https://via.placeholder.com/100?text=Kingston', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- CATEGORIES
-- ============================================================================

DO $$
DECLARE
  v_informatique_id UUID;
  v_electronique_id UUID;
BEGIN
  -- Get department IDs
  SELECT id INTO v_informatique_id FROM departments WHERE slug = 'informatique' LIMIT 1;
  SELECT id INTO v_electronique_id FROM departments WHERE slug = 'electronique' LIMIT 1;

  -- Informatique categories
  INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
  VALUES (v_informatique_id, NULL, 'ordinateurs-portables', 'Ordinateurs Portables', 'اجهزة كمبيوتر محمول', 1, true)
  ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

  INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
  VALUES (v_informatique_id, NULL, 'ordinateurs-de-bureau', 'Ordinateurs de Bureau', 'اجهزة كمبيوتر مكتبية', 2, true)
  ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

  -- Electronique categories
  INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
  VALUES (v_electronique_id, NULL, 'ecrans', 'Ecrans', 'شاشات', 1, true)
  ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

  INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
  VALUES (v_electronique_id, NULL, 'stockage', 'Stockage', 'التخزين', 2, true)
  ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

END $$;

-- ============================================================================
-- PRODUCTS
-- ============================================================================

DO $$
DECLARE
  v_informatique_id UUID;
  v_electronique_id UUID;
  v_laptops_cat_id UUID;
  v_monitors_cat_id UUID;
  v_storage_cat_id UUID;
  v_asus_brand_id UUID;
  v_msi_brand_id UUID;
  v_lg_brand_id UUID;
  v_samsung_brand_id UUID;
  v_logitech_brand_id UUID;
BEGIN
  -- Get IDs
  SELECT id INTO v_informatique_id FROM departments WHERE slug = 'informatique' LIMIT 1;
  SELECT id INTO v_electronique_id FROM departments WHERE slug = 'electronique' LIMIT 1;
  SELECT id INTO v_laptops_cat_id FROM categories WHERE slug = 'ordinateurs-portables' LIMIT 1;
  SELECT id INTO v_monitors_cat_id FROM categories WHERE slug = 'ecrans' LIMIT 1;
  SELECT id INTO v_storage_cat_id FROM categories WHERE slug = 'stockage' LIMIT 1;
  SELECT id INTO v_asus_brand_id FROM brands WHERE slug = 'asus' LIMIT 1;
  SELECT id INTO v_msi_brand_id FROM brands WHERE slug = 'msi' LIMIT 1;
  SELECT id INTO v_lg_brand_id FROM brands WHERE slug = 'lg' LIMIT 1;
  SELECT id INTO v_samsung_brand_id FROM brands WHERE slug = 'samsung' LIMIT 1;
  SELECT id INTO v_logitech_brand_id FROM brands WHERE slug = 'logitech' LIMIT 1;

  -- ASUS ROG Strix
  INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active)
  VALUES ('asus-rog-strix-g16', 'ASUS ROG Strix G16', 'ASUS ROG Strix G16', 'Gaming laptop haute performance avec ecran 16 pouces 240Hz', 'جهاز كمبيوتر محمول للالعاب عالي الاداء', v_asus_brand_id, v_informatique_id, v_laptops_cat_id, 289000, 349000, 'ASUS-ROG-G16-001', 5, true, true)
  ON CONFLICT (slug) DO NOTHING;

  -- MSI Katana
  INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active)
  VALUES ('msi-katana-15', 'MSI Katana 15', 'MSI Katana 15', 'Ordinateur portable gaming avec RTX 4060, ecran 144Hz', 'جهاز كمبيوتر محمول للالعاب مع RTX 4060', v_msi_brand_id, v_informatique_id, v_laptops_cat_id, 215000, 259000, 'MSI-KATANA-15-001', 3, true, true)
  ON CONFLICT (slug) DO NOTHING;

  -- LG Monitor
  INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active)
  VALUES ('lg-ultragear-27gp850', 'LG UltraGear 27GP850-B', 'LG UltraGear 27GP850-B', 'Ecran gaming 27 pouces 240Hz, 1ms IPS', 'شاشة العاب 27 بوصة 240 هرتز', v_lg_brand_id, v_electronique_id, v_monitors_cat_id, 89000, 109000, 'LG-27GP850-001', 8, true, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Samsung SSD
  INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active)
  VALUES ('samsung-990-pro-2tb', 'Samsung 990 PRO 2To', 'Samsung 990 PRO 2To', 'SSD NVMe ultra-rapide 7100 MB/s', 'محرك اقراص SSD NVMe فائق السرعة', v_samsung_brand_id, v_electronique_id, v_storage_cat_id, 45000, 54000, 'SAMSUNG-990-PRO-2TB', 12, true, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Logitech Mouse
  INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active)
  VALUES ('logitech-g502-x-plus', 'Logitech G502 X PLUS', 'Logitech G502 X PLUS', 'Souris gaming sans fil avec capteur HERO 25K', 'ماوس العاب لاسلكي مع محس HERO 25K', v_logitech_brand_id, v_informatique_id, v_laptops_cat_id, 32000, 39000, 'LOGITECH-G502-PLUS', 20, true, true)
  ON CONFLICT (slug) DO NOTHING;

END $$;

-- ============================================================================
-- SHIPPING CONFIGURATION
-- ============================================================================

INSERT INTO shipping_rules (free_shipping_threshold_dzd, default_fee_dzd)
VALUES (50000, 500)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  (SELECT COUNT(*) FROM departments) as departments,
  (SELECT COUNT(*) FROM brands) as brands,
  (SELECT COUNT(*) FROM categories) as categories,
  (SELECT COUNT(*) FROM products) as products;
