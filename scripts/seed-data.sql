-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

INSERT INTO departments (slug, name_fr, name_ar, icon, sort_order, is_active)
VALUES 
  ('informatique', 'Informatique', 'علوم الحاسب', 'laptop', 1, true),
  ('electronique', 'Électronique', 'الإلكترونيات', 'smartphone', 2, true),
  ('peripheriques', 'Périphériques', 'ملحقات', 'mouse', 3, true),
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
-- CATEGORIES
-- ============================================================================

-- Informatique categories
INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'ordinateurs-portables', 'Ordinateurs Portables', 'أجهزة الكمبيوتر المحمول', 1, true
FROM departments WHERE slug = 'informatique'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'ordinateurs-de-bureau', 'Ordinateurs de Bureau', 'أجهزة الكمبيوتر المكتبية', 2, true
FROM departments WHERE slug = 'informatique'
ON CONFLICT (slug) DO NOTHING;

-- Electronique categories
INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'ecrans', 'Ecrans', 'شاشات', 1, true
FROM departments WHERE slug = 'electronique'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT id, NULL, 'stockage', 'Stockage', 'التخزين', 2, true
FROM departments WHERE slug = 'electronique'
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- PRODUCTS
-- ============================================================================

-- Laptops
INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'asus-rog-strix-g16',
  'ASUS ROG Strix G16',
  'ASUS ROG Strix G16',
  'Gaming laptop haute performance avec ecran 16 pouces 240Hz',
  'جهاز كمبيوتر محمول للألعاب عالي الأداء مع شاشة 16 بوصة بسرعة 240 هرتز',
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
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'msi-katana-15',
  'MSI Katana 15',
  'MSI Katana 15',
  'Ordinateur portable gaming avec RTX 4060, ecran 144Hz',
  'جهاز كمبيوتر محمول للألعاب مع RTX 4060 وشاشة 144 هرتز',
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
ON CONFLICT (slug) DO NOTHING;

-- Monitors
INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'lg-ultragear-27gp850',
  'LG UltraGear 27GP850-B',
  'LG UltraGear 27GP850-B',
  'Ecran gaming 27 pouces 240Hz, 1ms IPS',
  'شاشة ألعاب 27 بوصة 240 هرتز 1 ميلي ثانية IPS',
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
ON CONFLICT (slug) DO NOTHING;

-- Storage
INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'samsung-990-pro-2tb',
  'Samsung 990 PRO 2To',
  'Samsung 990 PRO 2To',
  'SSD NVMe ultra-rapide 7100 MB/s',
  'محرك أقراص SSD NVMe فائق السرعة 7100 ميجابايت / ثانية',
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
ON CONFLICT (slug) DO NOTHING;

-- Peripherals
INSERT INTO products (slug, title_fr, title_ar, description_fr, description_ar, brand_id, department_id, category_id, price_dzd, compare_at_price_dzd, sku, stock, is_featured, is_active, sort_order)
SELECT 
  'logitech-g502-x-plus',
  'Logitech G502 X PLUS',
  'Logitech G502 X PLUS',
  'Souris gaming sans fil avec capteur HERO 25K',
  'ماوس ألعاب لاسلكي مع محس HERO 25K',
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
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- WILAYAS (Provinces)
-- ============================================================================

INSERT INTO wilayas (code, name_fr, name_ar, is_active)
VALUES
  ('01', 'Adrar', 'أدرار', true),
  ('16', 'Alger', 'الجزائر', true),
  ('23', 'Annaba', 'عنابة', true),
  ('05', 'Batna', 'باتنة', true),
  ('08', 'Béjaïa', 'بجاية', true),
  ('06', 'Biskra', 'بسكرة', true),
  ('07', 'Blida', 'البليدة', true),
  ('09', 'Bordj Bou Arréridj', 'برج بوعريريج', true),
  ('34', 'Boumerdès', 'بومرداس', true),
  ('10', 'Bouira', 'البويرة', true),
  ('02', 'Chlef', 'الشلف', true),
  ('19', 'Constantine', 'قسنطينة', true),
  ('17', 'Delizane', 'الدالية', true),
  ('32', 'Djelfa', 'الجلفة', true),
  ('24', 'El Bayadh', 'البيض', true),
  ('33', 'El Oued', 'الواد', true),
  ('31', 'Essaouira', 'الصحراء', true),
  ('27', 'Ghardaïa', 'غردايا', true),
  ('30', 'Guelma', 'قالمة', true),
  ('04', 'Batna', 'باتنة', true),
  ('03', 'Laghouat', 'الأغواط', true),
  ('29', 'Mascara', 'معسكر', true),
  ('26', 'Medea', 'المدية', true),
  ('25', 'Mila', 'ميلة', true),
  ('28', 'Mostaganem', 'مستغانم', true),
  ('18', 'Oran', 'وهران', true),
  ('15', 'Oum El Bouaghi', 'أم البواقي', true),
  ('11', 'Saïda', 'سعيدة', true),
  ('20', 'Saïda', 'سعيدة', true),
  ('12', 'Sétif', 'سطيف', true),
  ('21', 'Sidi Bel Abbès', 'سيدي بلعباس', true),
  ('22', 'Skikda', 'سكيكدة', true),
  ('41', 'Souk Ahras', 'سوق أهراس', true),
  ('14', 'Tébessa', 'تبسة', true),
  ('35', 'Tindouf', 'تندوف', true),
  ('37', 'Tiaret', 'تيارت', true),
  ('39', 'Tizi Ouzou', 'تيزي وزو', true),
  ('40', 'Tlmcen', 'تلمسان', true),
  ('36', 'Tissemsilt', 'تيسمسيلت', true),
  ('38', 'Tombouctou', 'تومبوكتو', true),
  ('13', 'Tipasa', 'تيبازة', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SHIPPING RATES
-- ============================================================================

INSERT INTO shipping_rates (wilaya_code, method, price_dzd, eta_min_days, eta_max_days)
SELECT code, 'home', CASE 
  WHEN code = '16' THEN 400  -- Alger
  ELSE 500
END, 2, 5
FROM wilayas
ON CONFLICT (wilaya_code, method) DO UPDATE SET price_dzd = EXCLUDED.price_dzd;

INSERT INTO shipping_rates (wilaya_code, method, price_dzd, eta_min_days, eta_max_days)
SELECT code, 'stopdesk', CASE 
  WHEN code = '16' THEN 300  -- Alger
  ELSE 400
END, 3, 7
FROM wilayas
ON CONFLICT (wilaya_code, method) DO UPDATE SET price_dzd = EXCLUDED.price_dzd;

-- ============================================================================
-- HOMEPAGE CONTENT
-- ============================================================================

INSERT INTO homepage_banners (title_fr, title_ar, description_fr, description_ar, image_url, link_url, sort_order, is_active)
VALUES
  ('Nouvelle Collection Printemps', 'مجموعة الربيع الجديدة', 'Decouvrez les derniers produits', 'اكتشف أحدث المنتجات', 'https://via.placeholder.com/1200x400?text=Spring+Collection', '/shop', 1, true),
  ('Promotion Gaming', 'عرض الألعاب', 'Jusqua 30% de reduction', 'يصل الخصم إلى 30٪', 'https://via.placeholder.com/1200x400?text=Gaming+Promo', '/shop?dept=informatique', 2, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MARQUEE BRANDS
-- ============================================================================

INSERT INTO marquee_brands (brand_id, logo_url, sort_order, is_active)
SELECT id, 'https://via.placeholder.com/200x100?text=' || name, ROW_NUMBER() OVER (ORDER BY created_at), true
FROM brands
LIMIT 5
ON CONFLICT (brand_id) DO NOTHING;
