-- ComputerHouse Production Verification Script
-- Run this to verify your database is correctly set up

-- ============================================================================
-- 1. CHECK SCHEMA INTEGRITY
-- ============================================================================

SELECT '1. TABLES' as check_name;
SELECT 
  COUNT(*) as total_tables,
  string_agg(tablename, ', ' ORDER BY tablename) as table_list
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
  'departments', 'categories', 'brands', 'products',
  'product_images', 'product_specs', 'product_variants',
  'carts', 'cart_items', 'orders', 'order_items',
  'shipping_addresses', 'wilayas', 'shipping_rates',
  'homepage_banners', 'marquee_brands'
);

-- ============================================================================
-- 2. CHECK DATA POPULATION
-- ============================================================================

SELECT '2. DATA COUNTS' as check_name;
SELECT 'departments' as table_name, COUNT(*) as count FROM departments
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'brands', COUNT(*) FROM brands
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'wilayas', COUNT(*) FROM wilayas
UNION ALL
SELECT 'shipping_rates', COUNT(*) FROM shipping_rates
UNION ALL
SELECT 'shipping_rules', COUNT(*) FROM shipping_rules
ORDER BY table_name;

-- ============================================================================
-- 3. CHECK DATA QUALITY
-- ============================================================================

SELECT '3. DATA QUALITY' as check_name;

-- Check for products with proper data
SELECT 
  'Products with proper category' as check,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 5 THEN 'PASS'
    ELSE 'FAIL - Need at least 5 products'
  END as status
FROM products 
WHERE is_active = true 
AND category_id IS NOT NULL 
AND department_id IS NOT NULL;

-- Check for categories with departments
SELECT 
  'Categories with departments' as check,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 9 THEN 'PASS'
    ELSE 'FAIL - Need at least 9 categories'
  END as status
FROM categories 
WHERE is_active = true 
AND department_id IS NOT NULL;

-- Check for wilayas
SELECT 
  'Wilayas (provinces)' as check,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 58 THEN 'PASS'
    ELSE 'FAIL - Need all 58 Algerian wilayas'
  END as status
FROM wilayas 
WHERE is_active = true;

-- Check for shipping rates
SELECT 
  'Shipping rates configured' as check,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 116 THEN 'PASS'
    ELSE 'FAIL - Need rates for all wilayas x 2 methods (58 x 2 = 116)'
  END as status
FROM shipping_rates;

-- ============================================================================
-- 4. CHECK RELATIONSHIPS
-- ============================================================================

SELECT '4. RELATIONSHIPS' as check_name;

-- Orphaned products (no category)
SELECT 
  'Products without categories' as check,
  COUNT(*) as orphaned_count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL - ' || COUNT(*) || ' products without categories'
  END as status
FROM products 
WHERE category_id IS NULL;

-- Orphaned categories (no department)
SELECT 
  'Categories without departments' as check,
  COUNT(*) as orphaned_count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL - ' || COUNT(*) || ' categories without departments'
  END as status
FROM categories 
WHERE department_id IS NULL;

-- Check product stock is non-negative
SELECT 
  'Products with valid stock' as check,
  COUNT(*) as valid_count,
  CASE 
    WHEN COUNT(CASE WHEN stock >= 0 THEN 1 END) = COUNT(*) THEN 'PASS'
    ELSE 'FAIL - Some products have negative stock'
  END as status
FROM products;

-- ============================================================================
-- 5. CHECK CONSTRAINTS
-- ============================================================================

SELECT '5. CONSTRAINTS' as check_name;

-- Check for duplicate slugs
SELECT 
  'No duplicate product slugs' as check,
  COUNT(DISTINCT slug) as unique_slugs,
  COUNT(*) as total_products,
  CASE 
    WHEN COUNT(DISTINCT slug) = COUNT(*) THEN 'PASS'
    ELSE 'FAIL - Duplicate product slugs exist'
  END as status
FROM products;

-- Check for duplicate department slugs
SELECT 
  'No duplicate department slugs' as check,
  COUNT(DISTINCT slug) as unique_slugs,
  COUNT(*) as total_departments,
  CASE 
    WHEN COUNT(DISTINCT slug) = COUNT(*) THEN 'PASS'
    ELSE 'FAIL - Duplicate department slugs exist'
  END as status
FROM departments;

-- ============================================================================
-- 6. SUMMARY REPORT
-- ============================================================================

SELECT '6. PRODUCTION READY CHECK' as check_name;

WITH checks AS (
  SELECT 'Database tables created' as check, 
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'departments' OR tablename LIKE 'products') >= 2 as passed
  UNION ALL
  SELECT 'Sample data seeded', (SELECT COUNT(*) FROM products) >= 5
  UNION ALL
  SELECT 'All wilayas configured', (SELECT COUNT(*) FROM wilayas) = 58
  UNION ALL
  SELECT 'Shipping rates ready', (SELECT COUNT(*) FROM shipping_rates) >= 100
  UNION ALL
  SELECT 'Admin auth table exists', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_sessions')
)
SELECT 
  check,
  CASE WHEN passed THEN 'PASS ✅' ELSE 'FAIL ❌' END as status
FROM checks;

-- ============================================================================
-- 7. SAMPLE PRODUCT CHECK
-- ============================================================================

SELECT '7. SAMPLE PRODUCTS' as check_name;

SELECT 
  p.title_fr,
  p.price_dzd,
  p.stock,
  d.name_fr as department,
  c.name_fr as category,
  b.name as brand,
  CASE WHEN p.is_active THEN 'Active' ELSE 'Inactive' END as status
FROM products p
LEFT JOIN departments d ON p.department_id = d.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
ORDER BY p.created_at DESC
LIMIT 10;

-- ============================================================================
-- 8. FINAL VERDICT
-- ============================================================================

SELECT '8. READY FOR PRODUCTION?' as check_name;

SELECT CASE 
  WHEN (SELECT COUNT(*) FROM departments) >= 4
    AND (SELECT COUNT(*) FROM products) >= 5
    AND (SELECT COUNT(*) FROM wilayas) = 58
    AND (SELECT COUNT(*) FROM shipping_rates) >= 100
  THEN 'YES - Database is ready for production! ✅'
  ELSE 'NO - Please review the checks above for any FAILs'
END as production_status;

-- ============================================================================
-- END VERIFICATION
-- ============================================================================
