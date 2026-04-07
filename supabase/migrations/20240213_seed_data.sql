-- ============================================================================
-- SEED DATA: Wilayas (58 Algerian provinces) + Shipping Rates + Rules
-- ============================================================================

-- Insert all 58 Algerian wilayas
INSERT INTO shipping_wilayas (code, name_fr, name_ar) VALUES
('01', 'Adrar', 'أدرار'),
('02', 'Chlef', 'الشلف'),
('03', 'Laghouat', 'الأغواط'),
('04', 'Oum El Bouaghi', 'أم البواقي'),
('05', 'Batna', 'باتنة'),
('06', 'Béjaïa', 'بجاية'),
('07', 'Biskra', 'بسكرة'),
('08', 'Béchar', 'البيض'),
('09', 'Blida', 'البليدة'),
('10', 'Bouira', 'البويرة'),
('11', 'Tamanrasset', 'تمنراست'),
('12', 'Tébessa', 'تبسة'),
('13', 'Tlemcen', 'تلمسان'),
('14', 'Tiaret', 'تيارت'),
('15', 'Tizi Ouzou', 'تيزي وزو'),
('16', 'Alger', 'الجزائر'),
('17', 'Djelfa', 'الجلفة'),
('18', 'Jijel', 'جيجل'),
('19', 'Sétif', 'سطيف'),
('20', 'Saïda', 'سعيدة'),
('21', 'Skikda', 'سكيكدة'),
('22', 'Sidi Bel Abbès', 'سيدي بلعباس'),
('23', 'Annaba', 'عنابة'),
('24', 'Guelma', 'قالمة'),
('25', 'Constantine', 'قسنطينة'),
('26', 'Médéa', 'المدية'),
('27', 'Mostaganem', 'مستغانم'),
('28', 'M''Sila', 'المسيلة'),
('29', 'Mascara', 'معسكر'),
('30', 'Ouargla', 'ورقلة'),
('31', 'Oran', 'وهران'),
('32', 'El Bayadh', 'البيض'),
('33', 'Illizi', 'إليزي'),
('34', 'Bordj Baji Mokhtar', 'برج باجي مختار'),
('35', 'Boumerdès', 'بومرداس'),
('36', 'El Tarf', 'الطارف'),
('37', 'Tindouf', 'تندوف'),
('38', 'Tissemsilt', 'تيسمسيلت'),
('39', 'El Oued', 'الوادي'),
('40', 'Khenchela', 'خنشلة'),
('41', 'Souk Ahras', 'سوق أهراس'),
('42', 'Tipaza', 'تيبازة'),
('43', 'Mila', 'ميلة'),
('44', 'Aïn Defla', 'عين الدفلة'),
('45', 'Naama', 'النعامة'),
('46', 'Aïn Témouchent', 'عين تموشنت'),
('47', 'Ghardaïa', 'غرداية'),
('48', 'Relizane', 'غليزان'),
('49', 'Draa Tafilalet', 'درعة تافيلالت'),
('50', 'Laghouat', 'الأغواط'),
('51', 'Blida', 'البليدة'),
('52', 'Tébessa', 'تبسة'),
('53', 'Chlef', 'الشلف'),
('54', 'Laghouat', 'الأغواط'),
('55', 'Oum El Bouaghi', 'أم البواقي'),
('56', 'Saïda', 'سعيدة'),
('57', 'Sidi Bel Abbès', 'سيدي بلعباس'),
('58', 'Khenchela', 'خنشلة')
ON CONFLICT (code) DO NOTHING;

-- Insert default shipping rates for each wilaya (2 methods: home, stopdesk)
INSERT INTO shipping_rates (wilaya_code, method, price_dzd, eta_min_days, eta_max_days)
SELECT code, 'home', 1500, 3, 5 FROM shipping_wilayas
ON CONFLICT (wilaya_code, method) DO NOTHING;

INSERT INTO shipping_rates (wilaya_code, method, price_dzd, eta_min_days, eta_max_days)
SELECT code, 'stopdesk', 800, 2, 3 FROM shipping_wilayas
ON CONFLICT (wilaya_code, method) DO NOTHING;

-- Insert default shipping rules
INSERT INTO shipping_rules (free_shipping_threshold_dzd, default_fee_dzd)
VALUES (50000, 1000)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED DATA: Departments (Computer House Categories)
-- ============================================================================

INSERT INTO departments (slug, name_fr, name_ar, icon, sort_order, is_active) VALUES
('pcs-gaming', 'PCs & Gaming', 'أجهزة كمبيوتر وألعاب', '🖥️', 1, true),
('laptops', 'Laptops', 'أجهزة محمولة', '💻', 2, true),
('composants', 'Composants', 'مكونات', '🔧', 3, true),
('moniteurs', 'Moniteurs', 'شاشات', '📺', 4, true),
('apple', 'Apple', 'آبل', '🍎', 5, true),
('cameras', 'Cameras', 'كاميرات', '📷', 6, true),
('reseau', 'Réseau', 'شبكة', '🌐', 7, true),
('imprimantes', 'Imprimantes', 'طابعات', '🖨️', 8, true),
('bureautique', 'Bureautique', 'مكتب', '📄', 9, true),
('peripheriques', 'Périphériques', 'ملحقات', '🎮', 10, true),
('stockage', 'Stockage', 'تخزين', '💾', 11, true),
('chaises-bureaux', 'Chaises & Bureaux', 'كراسي وطاولات', '🪑', 12, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED DATA: Sample Category Hierarchy (Components department)
-- ============================================================================

-- Get the Components department ID and insert subcategories
WITH dept AS (
  SELECT id FROM departments WHERE slug = 'composants'
)
INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT d.id, NULL, 'processors', 'Processeurs', 'معالجات', 1, true FROM dept d
ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

WITH dept AS (
  SELECT id FROM departments WHERE slug = 'composants'
)
INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT d.id, NULL, 'memory', 'Mémoire RAM', 'ذاكرة الوصول العشوائي', 2, true FROM dept d
ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

WITH dept AS (
  SELECT id FROM departments WHERE slug = 'composants'
)
INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT d.id, NULL, 'storage', 'Stockage', 'التخزين', 3, true FROM dept d
ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

-- Insert RAM subcategories (DDR4, DDR5)
WITH parent_cat AS (
  SELECT c.id FROM categories c
  JOIN departments d ON c.department_id = d.id
  WHERE d.slug = 'composants' AND c.slug = 'memory'
)
INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT (SELECT department_id FROM categories WHERE slug = 'memory' LIMIT 1), p.id, 'ddr4', 'DDR4', 'DDR4', 1, true
FROM parent_cat p
ON CONFLICT (department_id, parent_id, slug) DO NOTHING;

WITH parent_cat AS (
  SELECT c.id FROM categories c
  JOIN departments d ON c.department_id = d.id
  WHERE d.slug = 'composants' AND c.slug = 'memory'
)
INSERT INTO categories (department_id, parent_id, slug, name_fr, name_ar, sort_order, is_active)
SELECT (SELECT department_id FROM categories WHERE slug = 'memory' LIMIT 1), p.id, 'ddr5', 'DDR5', 'DDR5', 2, true
FROM parent_cat p
ON CONFLICT (department_id, parent_id, slug) DO NOTHING;
