# ComputerHouse Production Checklist

Complete this checklist to verify the ecommerce platform is working end-to-end.

## 1. Database & Migrations

- [x] Supabase project created and connected
- [x] Initial schema migration executed (20240213_initial_schema.sql)
- [x] Seed data executed (scripts/seed-final.sql)
- [ ] Verify 15 departments exist: `SELECT COUNT(*) FROM departments;`
- [ ] Verify 10 brands exist: `SELECT COUNT(*) FROM brands;`
- [ ] Verify 9 categories exist: `SELECT COUNT(*) FROM categories;`
- [ ] Verify 5 products exist: `SELECT COUNT(*) FROM products;`

## 2. Admin Panel Setup

### 2.1 Admin Authentication
- [ ] Navigate to `/admin/login`
- [ ] Enter password: `computerh2026` (or your ADMIN_PANEL_PASSWORD)
- [ ] Verify redirect to `/admin` dashboard
- [ ] Check that logout button appears in sidebar
- [ ] Click logout, verify redirect to `/admin/login`

### 2.2 Admin Dashboard
- [ ] Dashboard displays KPIs (Revenue, Orders, Products, Low Stock)
- [ ] Dashboard shows recent orders (if any exist)
- [ ] Low stock alerts display correctly

### 2.3 Products Management
- [ ] `/admin/products` lists all 5 seeded products
- [ ] Search functionality filters products
- [ ] Stock column displays correctly
- [ ] Click product to view details
- [ ] Create new product:
  - [ ] Fill all required fields (title, price, stock, SKU, department, category)
  - [ ] Product appears in list after creation
  - [ ] Navigate to product in store and verify visibility

### 2.4 Orders Management
- [ ] `/admin/orders` displays orders page
- [ ] Status filter dropdown works
- [ ] Click eye icon to view order details
- [ ] Order status can be updated

### 2.5 Shipping Configuration
- [ ] `/admin/shipping` loads shipping rates
- [ ] Can view rates for different wilayas
- [ ] Can update shipping prices

## 3. Store Frontend

### 3.1 Shop Page
- [ ] `/shop` loads and displays 5 products
- [ ] Filter by department works
- [ ] Filter by brand works
- [ ] Price range slider works
- [ ] Sort by price works
- [ ] Grid/List view toggle works
- [ ] Product cards display correct image, price, and stock

### 3.2 Product Detail
- [ ] Click on a product from shop
- [ ] Product detail page loads with full information
- [ ] Related products section displays
- [ ] Add to cart button works

### 3.3 Cart & Checkout
- [ ] Add product to cart
- [ ] Cart icon updates quantity
- [ ] `/cart` page displays added products
- [ ] Can change quantity in cart
- [ ] Can remove items from cart
- [ ] Proceed to checkout button appears
- [ ] `/checkout` page shows:
  - [ ] Order summary with subtotal
  - [ ] Shipping method selector (home delivery, stopdesk)
  - [ ] Wilaya selector
  - [ ] Shipping cost calculation
  - [ ] Final total with shipping included
- [ ] Submit order:
  - [ ] Order is created in database
  - [ ] Order number is generated
  - [ ] Stock is decremented for purchased items
  - [ ] Order appears in admin dashboard
  - [ ] Thank you page displays with order number

## 4. Stock Management

- [ ] Create product with stock = 5
- [ ] Add product to cart 3 times
- [ ] Verify product stock displays as 2 remaining
- [ ] Checkout with 3 units
- [ ] Verify stock decrements to 0 after order
- [ ] Cannot checkout if stock < order quantity

## 5. Multi-Wilaya Shipping

- [ ] Alger (01) shows correct shipping cost
- [ ] Oran (31) shows different shipping cost
- [ ] Constantine (25) shows different cost
- [ ] Total price updates when wilaya changes
- [ ] Total price updates when delivery method changes

## 6. Admin Stock Control

- [ ] After order, admin can view product stock is decremented
- [ ] Admin can manually edit product stock
- [ ] Stock changes are reflected in store

## 7. Integration Tests

### 7.1 Full Purchase Flow
1. [ ] Start with fresh session (clear cookies)
2. [ ] Browse products by department
3. [ ] Filter by brand
4. [ ] Add 2 different products to cart
5. [ ] Change quantities
6. [ ] Remove one product
7. [ ] Select wilaya (Alger)
8. [ ] Select delivery method (home)
9. [ ] Verify shipping cost appears
10. [ ] Checkout and complete order
11. [ ] Verify order appears in admin
12. [ ] Verify stock decremented

### 7.2 Admin Full Flow
1. [ ] Login to admin
2. [ ] Create new department
3. [ ] Create new category under department
4. [ ] Create new brand
5. [ ] Create new product under category
6. [ ] View product in store
7. [ ] Add product to cart in store
8. [ ] Complete checkout
9. [ ] View order in admin
10. [ ] Update order status

## 8. Performance & Security

- [ ] Admin routes redirect to login if not authenticated
- [ ] Service role key is used only server-side
- [ ] Database queries use parameterized statements
- [ ] All admin actions are server-side (no secrets exposed)
- [ ] Session cookies are httpOnly
- [ ] No mock data imports remain in production code

## 9. Environment Variables

Ensure all required variables are set in Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PANEL_PASSWORD=your_secure_password
```

## 10. Deployment Verification

- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Deploy to Vercel
- [ ] Test admin login on production
- [ ] Test product purchase on production
- [ ] Verify database queries work with production env vars

## Notes

- Default admin password: `computerh2026`
- Seed data includes 5 sample products for testing
- Wilayas (provinces) are pre-populated with codes 01-58
- Shipping rates are configurable per wilaya and delivery method
- Orders are tracked with unique order_number and session_id
