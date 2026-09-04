# SYSTEM ARCHITECTURE AUDIT - NUTRITIONS STORE

**Date:** April 21, 2026  
**Status:** PRODUCTION SYSTEM - CRITICAL ISSUES FOUND  
**Technology:** Next.js 15 + Supabase (PostgreSQL) + Stripe-ready (not implemented)

---

## EXECUTIVE SUMMARY

This is a **B2C e-commerce store** focused on nutritional supplements. The system is **95% frontend/UX complete** but **fundamentally broken for real business operations**. It will fail catastrophically in production use.

**Critical Problems:**
- ❌ Stock is NEVER deducted when orders are placed
- ❌ No cost tracking (can't calculate profit)
- ❌ No purchase/supplier system
- ❌ No payment processing (cash-only mode)
- ❌ No refund/return system
- ❌ No financial reconciliation possible

---

## 1. DATABASE ANALYSIS

### 1.1 Complete Table Inventory

#### CATALOG TABLES (Product Management)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `departments` | Top-level categories (Proteins, Performance, Recovery, etc.) | id, slug, name_fr, name_ar, sort_order, is_active |
| `categories` | Hierarchical subcategories under departments | id, department_id, parent_id, slug, name_fr, name_ar |
| `brands` | Product manufacturers (e.g., Gold Standard, Optimum Nutrition) | id, name, slug, logo_url, is_active |
| `products` | Core product table | id, title_fr, title_ar, brand_id, department_id, category_id, **price_dzd**, **sku**, **stock** (INTEGER) |
| `product_images` | Image gallery per product | id, product_id, url, alt_fr, alt_ar, sort_order |
| `product_specs` | Specifications (e.g., flavor, size, servings) | id, product_id, key, value_fr, value_ar |
| `product_variants` | Variants (sizes, colors, flavors) | id, product_id, name, value, price_delta_dzd, **stock** (INTEGER) |

**Stock Management Issue #1:**
- Stock is stored as a plain `INTEGER`
- Example: `products.stock = 50` means "we have 50 units"
- When an order is placed with qty=5, **stock is NOT updated** (stays at 50)

---

#### COMMERCE TABLES (Orders & Sales)
| Table | Purpose | Key Fields | CRITICAL ISSUE |
|-------|---------|-----------|-----------------|
| `carts` | Shopping cart sessions | id, session_id, status (active/abandoned/converted) | Session-based (no user accounts) |
| `cart_items` | Items in cart | id, cart_id, product_id, variant_id, qty, price_snapshot_dzd | Snapshot capture (good) |
| `orders` | Customer orders | id, order_number, session_id, **status** (pending/confirmed/processing/shipped/delivered/cancelled), **payment_method** (cash/bank_transfer), subtotal_dzd, shipping_dzd, total_dzd, address_snapshot | **Stock NOT deducted here** |
| `order_items` | Line items of order | id, order_id, product_id, variant_id, title_snapshot, unit_price_dzd, qty, line_total_dzd | Snapshot capture (good) |
| `addresses` | Shipping addresses | id, session_id, full_name, phone, wilaya_code, address_line1, address_line2 | Anonymous addresses (no user tracking) |

**Stock Management Issue #2:**
When order is created:
1. Order record is inserted with all details ✅
2. Order items are inserted with qty and prices ✅
3. **NOTHING happens to product.stock or product_variants.stock** ❌
4. Stock remains unchanged forever

**Real scenario:**
```sql
-- Product has 10 units
SELECT stock FROM products WHERE id = 'ABC' LIMIT 1;  -- Returns: 10

-- Customer orders 5 units
INSERT INTO orders(...) VALUES(...);
INSERT INTO order_items(...) VALUES(...);

-- Stock is STILL 10
SELECT stock FROM products WHERE id = 'ABC' LIMIT 1;  -- Returns: 10 (WRONG!)
```

**Consequences:**
- Multiple customers can order the same 10 units (overselling)
- Stock shown to customers is NEVER accurate
- Admin thinks they have stock they don't
- Impossible to fulfill orders correctly

---

#### SHIPPING TABLES
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `shipping_wilayas` | Algerian provinces (58 total) | code (PRIMARY KEY), name_fr, name_ar |
| `shipping_rates` | Shipping cost per province & method | id, wilaya_code, method (standard/express), price_dzd, eta_min_days, eta_max_days |
| `shipping_rules` | Global shipping settings | free_shipping_threshold_dzd (15,000), default_fee_dzd (500) |

---

#### CUSTOMER TRACKING
| Table | Purpose |
|-------|---------|
| `customer_profiles` | Basic customer info (first_name, last_name, email, phone) - session-based, NO authentication |
| `site_visitors` | Page tracking (session_id, page_path, referrer, timestamp) - for analytics |
| `admin_notification_subscriptions` | Push notifications for admin (orders, events) |

**Customer Tracking Issue:**
- No real user accounts - everything is session-based
- Can't track repeat customers
- Can't build customer history
- No login system for customers (only admin has login)

---

#### CONTENT & SETTINGS
| Table | Purpose |
|-------|---------|
| `homepage_banners` | Hero section marketing banners |
| `marquee_brands` | Brand carousel on homepage |
| `navbar_items` | Navbar menu items (dynamic management) |
| `custom_pages` | CMS pages (About, FAQ, Contact, etc.) |
| `custom_page_products` | Products linked to custom pages |
| `store_settings` | Store metadata (name, contact, social media, hours) |

---

### 1.2 Relationships Map

```
departments
    ├── categories (many)
    │   └── products (many)
    │       ├── product_variants (many) → has stock ❌
    │       ├── product_images (many)
    │       ├── product_specs (many)
    │       └── product_images, product_specs
    │
    └── products (many)
        └── brand (one)

carts (session-based)
    └── cart_items (many)
        └── products (one)
        └── product_variants (one, optional)

orders
    ├── order_items (many)
    │   └── products (one)
    │   └── product_variants (one, optional)
    └── addresses (one snapshot)

shipping_wilayas
    └── shipping_rates (many)
```

**Missing Relationships:**
- `suppliers` → NOT IMPLEMENTED
- `purchase_orders` → NOT IMPLEMENTED
- `stock_movements` → NOT IMPLEMENTED (no audit trail)
- `users/customers` → NOT IMPLEMENTED (session-only)
- `invoices` → NOT IMPLEMENTED
- `payments` → NOT IMPLEMENTED (no payment processor)

---

## 2. BUSINESS LOGIC ANALYSIS

### 2.1 How a Sale is Created (Step by Step)

#### STEP 1: Customer Browses & Adds to Cart
**Location:** `app/(store)/cart` (client-side React)

```typescript
// When customer clicks "Add to Cart"
const cart = useCart(); // Zustand store
cart.addItem(product, quantity, variantId?);

// Cart stored in localStorage (NO database)
// Stock is checked ONLY for display:
inStock: (dbProduct.stock || 0) > 0  // Just shows "In Stock" or "Out"
stockCount: dbProduct.stock || 0      // Shows count to customer

// PROBLEM: No validation that qty ≤ stock
// Customer can add 100 items to cart even if stock = 5
```

#### STEP 2: Customer Proceeds to Checkout
**Location:** `app/(store)/checkout/page.tsx`

```typescript
// Form collects:
- firstName, lastName
- phone
- address, wilaya_code
- deliveryMethod (home or desk)
- paymentMethod (cash only)
- cartItems (from localStorage)
- subtotal, shipping, total

// NO stock validation here either!
// NO payment processing!
```

#### STEP 3: Order is Created
**Location:** `app/(store)/checkout/actions.ts` → `placeOrder()`

```typescript
// 1. Generate order number
const orderNumber = `CH-${Date.now()}`;

// 2. Create order record
const order = await createOrder({
  order_number: orderNumber,
  session_id: sessionId,
  status: 'pending',
  payment_method: paymentMethod,
  subtotal_dzd: subtotal,
  shipping_dzd: shipping,
  total_dzd: total,
  wilaya_code: parseInt(wilayaCode, 10),
  delivery_method: deliveryMethod,
  address_snapshot: { firstName, lastName, phone, address, ... },
});

// 3. Add order items
for (const item of cartItems) {
  await addOrderItem({
    order_id: order.id,
    product_id: item.product.id,
    variant_id: item.variantId || undefined,
    title_snapshot: item.product.name.fr,
    unit_price_dzd: item.product.price,
    qty: item.quantity,
    line_total_dzd: item.product.price * item.quantity,
  });
}

// ❌ CRITICAL: NO STOCK DEDUCTION HERE!
// The product.stock and product_variants.stock are NEVER touched!
```

#### STEP 4: Notifications & Completion
```typescript
// Send webhook to admin notification API
await fetch('/api/send-order-notification', {
  method: 'POST',
  body: {
    order_id, order_number, customer_name, phone,
    address, wilaya_code, total_amount, cartItems
  }
});

// Clear cart session
// Return success
```

---

### 2.2 Stock Management (THE PROBLEM)

#### Current Implementation:
```
Product Stock: INTEGER (e.g., 50)
        ↓
Customer adds qty=5 to cart → Stock still 50
        ↓
Order created → Stock still 50
        ↓
Customer adds qty=6 to cart (same product) → Stock still 50
        ↓
Two orders placed:
  - Order #1: qty=5 (fulfilled from stock)
  - Order #2: qty=6 (NO STOCK! But order exists!)
```

#### What SHOULD Happen:
```
Product Stock: 50
        ↓
Order #1: qty=5 → Stock: 50 - 5 = 45
        ↓
Order #2: qty=6 → Stock: 45 - 6 = 39
        ↓
Order #3: qty=40 (requested) → BLOCKED! Only 39 available
```

#### Proof in Code:
In `lib/repositories.ts`, the `addOrderItem()` function:
```typescript
export async function addOrderItem(data: {
  order_id: string;
  product_id: string;
  variant_id?: string;
  title_snapshot: string;
  unit_price_dzd: number;
  qty: number;
  line_total_dzd: number;
}) {
  const { data: result, error } = await supabaseAdmin
    .from('order_items')
    .insert([data])
    .select()
    .single();
  
  // 🔴 NOTHING ELSE HAPPENS - NO STOCK UPDATE!
  if (error) throw error;
  return result;
}
```

**There is NO trigger, NO update statement, NO stock deduction anywhere.**

---

### 2.3 Payment & Money Tracking

#### What's Implemented:
```typescript
payment_method: 'cash' | 'bank_transfer'  // User selects, but NOT processed
```

#### What's MISSING:
- No Stripe integration (mentioned in readme but not implemented)
- No actual payment processing
- No payment status tracking
- No invoice generation
- No payment confirmation to customer
- No refund logic
- All orders are created as "pending" indefinitely

#### Current Flow:
```
Customer places order
  → Order status = 'pending'
  → No payment is actually taken
  → Admin sees order with cash payment selected
  → Admin manually collects cash (or doesn't)
  → No way to track if payment was received
```

---

### 2.4 Stock Updates (Admin Panel)

**Location:** `app/admin/products/page.tsx`

When admin updates a product:
```typescript
// Admin enters new stock value
const newStock = 25;

// API call
await updateProduct(productId, { stock: newStock });

// In repository:
const { data: result, error } = await supabaseAdmin
  .from('products')
  .update({
    stock: Number.isFinite(data.stock) && data.stock >= 0 ? data.stock : 0,
    // ... other fields ...
  })
  .eq('id', id)
  .select()
  .single();
```

**This is a COMPLETE OVERRIDE, not a proper stock system.**

Scenario:
```
Product stock in DB: 50

Admin checks stock: "50 units"
Meanwhile, 10 customers order (should be 40)

Admin enters: 50 (wrong number)
Stock becomes: 50 (completely lost the 10 orders)

OR

Admin enters: 25
Stock becomes: 25 (arbitrary value, no tracking of why)

NO AUDIT TRAIL
NO HISTORY
NO RECONCILIATION POSSIBLE
```

---

## 3. PROBLEMS & LIMITATIONS

### 3.1 CRITICAL ISSUES (System Cannot Function)

| Issue | Impact | Severity |
|-------|--------|----------|
| **Stock not deducted on order** | Overselling, customer can order unlimited units | 🔴 CRITICAL |
| **No payment processing** | No actual revenue collection (cash only) | 🔴 CRITICAL |
| **No cost tracking** | Can't calculate profit (COGS not tracked) | 🔴 CRITICAL |
| **No inventory audit trail** | Can't reconcile stock differences | 🔴 CRITICAL |
| **No customer accounts** | Can't track repeat customers or order history | 🔴 CRITICAL |

### 3.2 MAJOR ISSUES (Business Gaps)

| Issue | Impact |
|-------|--------|
| No purchase order system | Can't track incoming stock or supplier costs |
| No batch/serial number tracking | Can't track expiry dates (critical for supplements) |
| No refund/return system | No way to handle returns or restocking |
| No stock reconciliation | Can't do inventory audits |
| No damage/waste tracking | Lost product not tracked |
| No multi-warehouse support | Single location only |
| No currency management | Only DZD (Algerian Dinar) |
| No tax calculation | Tax not tracked (if applicable) |

### 3.3 DATA INTEGRITY RISKS

```
SCENARIO 1: Overselling
- Product stock = 5 units
- 10 customers order 1 unit each
- All orders created successfully
- Only 5 units actually exist
- 5 customers will be disappointed

SCENARIO 2: Stock Loss
- Product stock = 100 units
- Admin accidentally enters 50
- No way to know what happened to 50 units
- Could be:
  - Damaged goods (not tracked)
  - Theft (not tracked)
  - Admin error (not logged)
  - Actually sold but stock not deducted

SCENARIO 3: Negative Stock
- Admin updates stock to 0
- Customer still has it in cart
- Customer places order with qty=5
- Stock becomes -5 (is this allowed? no validation)
- Orders with negative stock = system corrupted

SCENARIO 4: Ghost Orders
- Customer places order for out-of-stock item
- No validation prevents this
- Order exists with status='pending'
- Admin can't fulfill because product doesn't exist
- Customer angry
```

---

## 4. API & FLOW ANALYSIS

### 4.1 Store Frontend Flow

```
┌─────────────────────────────────────┐
│  Customer (store.example.com)        │
└──────────────┬──────────────────────┘
               │
        Browse Products
               │
        ┌──────▼──────────┐
        │ Get Departments  │ → repo.getDepartments()
        │ Get Categories   │ → repo.getCategoriesByDepartment()
        │ Get Products     │ → repo.getProducts()
        └──────┬───────────┘
               │
        Add to Cart (localStorage)
               │
        ┌──────▼──────────┐
        │  Checkout Flow   │
        │  - Fill Address  │
        │  - Select Shipping
        │  - Confirm Order │
        └──────┬───────────┘
               │
        ┌──────▼────────────────────────────────────┐
        │ POST /checkout/actions.placeOrder()       │
        │  ├─ Validate form data ✅                 │
        │  ├─ Create order record ✅                │
        │  ├─ Add order items ✅                    │
        │  ├─ Deduct stock ❌ MISSING!             │
        │  ├─ Process payment ❌ MISSING!          │
        │  └─ Send notification ✅                 │
        └──────┬────────────────────────────────────┘
               │
        ┌──────▼──────────────────────┐
        │ Order Created (status: pending)
        │ id: abc123
        │ order_number: CH-1713689200 │
        └──────────────────────────────┘
```

### 4.2 Admin Flow

```
┌──────────────────────────────┐
│  Admin (store.example.com/admin)
└──────────────┬───────────────┘
               │
        Login with Password
               │
        ┌──────▼────────────────────────────────┐
        │ DASHBOARD                             │
        │ ├─ Analytics (revenue, items sold)    │
        │ ├─ Recent Orders                      │
        │ ├─ Top Products                       │
        │ └─ Top Brands                         │
        └──────┬────────────────────────────────┘
               │
        ┌──────┴─────────┬──────────────┬──────────────┬──────────┐
        │                │              │              │          │
    PRODUCTS         CATEGORIES      ORDERS        ANALYTICS    SETTINGS
        │                │              │              │          │
    ┌───▼────┐      ┌────▼─────┐   ┌──▼────┐      ┌──▼─────┐  ┌─▼────┐
    │ Create  │      │ Manage   │   │ View  │      │ Revenue│  │Store │
    │ Product │      │ Hierarchy│   │ Order │      │ Charts │  │Metadata
    │ Update  │      │          │   │ Status│      │ Trends │  │      │
    │ Delete  │      │          │   │ Mark  │      │ Brand  │  │      │
    │         │      │          │   │ shipped│      │ Report │  │      │
    │ ❌ NO  │      │          │   │ ❌ NO │      │ (Basic)│  │      │
    │ STOCK  │      │          │   │REFUND │      │        │  │      │
    │ DEDUCT │      │          │   │LOGIC  │      │        │  │      │
    └────────┘      └──────────┘   └───────┘      └────────┘  └──────┘
```

### 4.3 Detailed Endpoints

**Public Store API:**
```
GET  /api/products               (repo.getProducts)
GET  /api/products/:id           (repo.getProductById)
GET  /api/departments            (repo.getDepartments)
GET  /api/categories             (repo.getCategoriesByDepartment)
```

**Cart/Order Operations:**
```
POST /checkout/actions.placeOrder()
  ├─ Creates order record
  ├─ Adds order items
  ├─ ❌ Does NOT deduct stock
  ├─ ❌ Does NOT process payment
  └─ Sends webhook notification
```

**Admin Operations:**
```
POST /admin/actions.adminCreateProduct()
  ├─ Creates product
  ├─ Takes stock parameter
  └─ ❌ No cost/purchase tracking

POST /admin/actions.adminUpdateProduct()
  ├─ Updates product stock (OVERRIDE, not deduction)
  ├─ ❌ No audit trail
  └─ ❌ No history tracking

GET /admin/actions.adminGetOrders()
  ├─ Returns orders with status
  └─ ❌ No payment status

GET /admin/analytics
  ├─ Shows revenue (sum of order totals)
  ├─ Shows items sold (sum of order quantities)
  ├─ ❌ Does NOT show profit (no cost data)
  ├─ ❌ Does NOT show inventory value
  └─ Basic analytics only
```

**Notification API:**
```
POST /api/send-order-notification
  ├─ Sends push notification to admin
  ├─ Contains order details
  └─ Only for alerts, not transaction processing
```

---

## 5. WHAT'S MISSING FOR A REAL ERP SYSTEM

### 5.1 Inventory Management

**MUST ADD:**
```sql
-- Purchase orders table
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY,
  supplier_id UUID NOT NULL,
  po_number TEXT UNIQUE,
  status TEXT, -- draft, ordered, received, partial
  order_date TIMESTAMP,
  expected_delivery TIMESTAMP,
  actual_delivery TIMESTAMP,
  total_cost_dzd DECIMAL,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY,
  po_id UUID REFERENCES purchase_orders(id),
  product_id UUID REFERENCES products(id),
  qty_ordered INTEGER,
  qty_received INTEGER,
  unit_cost_dzd DECIMAL NOT NULL, -- cost per unit
  total_cost_dzd DECIMAL,
  created_at TIMESTAMP
);

-- Stock movements audit trail
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  movement_type TEXT, -- 'sale', 'purchase', 'adjustment', 'damage', 'return'
  qty_change INTEGER,
  reference_type TEXT, -- 'order', 'po', 'manual', 'return'
  reference_id UUID,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Stock reconciliation
CREATE TABLE stock_counts (
  id UUID PRIMARY KEY,
  count_date TIMESTAMP,
  counted_by TEXT,
  notes TEXT,
  created_at TIMESTAMP
);

CREATE TABLE stock_count_items (
  id UUID PRIMARY KEY,
  count_id UUID REFERENCES stock_counts(id),
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  expected_qty INTEGER,
  counted_qty INTEGER,
  variance INTEGER, -- counted_qty - expected_qty
  variance_reason TEXT
);
```

### 5.2 Cost & Profitability

**MUST ADD:**
```sql
-- Product cost tracking
ALTER TABLE products ADD COLUMN cost_dzd DECIMAL(10,2);
ALTER TABLE product_variants ADD COLUMN cost_dzd DECIMAL(10,2);

-- Order costing
CREATE TABLE order_costs (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  total_cogs_dzd DECIMAL, -- sum of unit costs
  total_profit_dzd DECIMAL, -- total revenue - total cogs
  created_at TIMESTAMP
);

-- Expense tracking
CREATE TABLE expenses (
  id UUID PRIMARY KEY,
  category TEXT, -- 'rent', 'utilities', 'payroll', 'shipping', 'marketing'
  amount_dzd DECIMAL,
  description TEXT,
  receipt_url TEXT,
  date TIMESTAMP,
  created_at TIMESTAMP
);
```

### 5.3 Payment Processing

**MUST ADD:**
```sql
-- Payment tracking
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  method TEXT, -- 'cash', 'card', 'bank_transfer', 'stripe'
  status TEXT, -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  amount_dzd DECIMAL,
  reference_number TEXT, -- transaction ID, check #, etc.
  date_initiated TIMESTAMP,
  date_completed TIMESTAMP,
  created_at TIMESTAMP
);

-- Refunds
CREATE TABLE refunds (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  reason TEXT,
  amount_dzd DECIMAL,
  status TEXT, -- 'pending', 'processed'
  date_requested TIMESTAMP,
  date_processed TIMESTAMP,
  created_at TIMESTAMP
);
```

### 5.4 Supplier Management

**MUST ADD:**
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms TEXT, -- net 30, net 60, etc.
  default_currency TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE supplier_product_catalogs (
  id UUID PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id),
  product_id UUID REFERENCES products(id),
  supplier_sku TEXT,
  unit_cost_dzd DECIMAL,
  lead_time_days INTEGER,
  minimum_order_qty INTEGER,
  created_at TIMESTAMP
);
```

### 5.5 Customer Management

**MUST ADD:**
```sql
-- Real user accounts (not session-based!)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Customer profiles linked to users
CREATE TABLE customer_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  total_spent_dzd DECIMAL,
  is_active BOOLEAN,
  created_at TIMESTAMP
);

-- Customer balance (receivables)
CREATE TABLE customer_balances (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customer_accounts(id),
  balance_dzd DECIMAL, -- positive = owe us, negative = we owe them
  last_payment TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 5.6 Reporting & Reconciliation

**MUST ADD:**
```sql
-- Daily closing
CREATE TABLE daily_closings (
  id UUID PRIMARY KEY,
  closing_date DATE UNIQUE,
  cash_in_hand_dzd DECIMAL,
  bank_deposits_dzd DECIMAL,
  expected_cash_dzd DECIMAL,
  variance_dzd DECIMAL,
  notes TEXT,
  closed_by TEXT,
  created_at TIMESTAMP
);

-- Financial reports (view)
CREATE VIEW daily_sales_report AS
SELECT 
  DATE(o.created_at) as sale_date,
  COUNT(DISTINCT o.id) as order_count,
  SUM(o.total_dzd) as revenue_dzd,
  SUM(oi.qty) as items_sold,
  SUM(oi.qty * 
      COALESCE(p.cost_dzd, 0)) as cogs_dzd,
  SUM(o.total_dzd) - SUM(oi.qty * COALESCE(p.cost_dzd, 0)) as gross_profit_dzd
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
GROUP BY DATE(o.created_at);
```

---

## 6. BUSINESS LOGIC PROBLEMS RANKED BY SEVERITY

### 🔴 CRITICAL (Fix Immediately)

**1. Stock Deduction Missing**
- When order is placed, product stock is NEVER reduced
- **Solution:** Update stock in transaction when order is created
```sql
-- Add BEFORE INSERTING order_items:
UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?;
UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?;

-- AND add check:
IF stock < 0 THEN RAISE EXCEPTION 'Insufficient stock';
END IF;
```

**2. No Payment Processing**
- Orders marked "cash" but no actual payment collected
- No way to track if customer paid
- **Solution:** Integrate Stripe or require payment before order creation
```typescript
// Before accepting order:
const payment = await stripe.paymentIntents.create({
  amount: total_dzd * 100, // cents
  currency: 'dzd', // if supported
  payment_method: formData.get('paymentMethod'),
});

if (payment.status !== 'succeeded') {
  throw new Error('Payment failed');
}

// Then create order with payment.id
await createOrder({ ..., payment_id: payment.id });
```

**3. Stock Not Validated During Checkout**
- Customer can add infinite quantity to cart
- No check: does the store have this much stock?
- **Solution:** Add validation at checkout:
```typescript
// In placeOrder():
for (const item of cartItems) {
  const product = await repo.getProductById(item.product.id);
  if (product.stock < item.quantity) {
    throw new Error(`Only ${product.stock} units available for ${product.title}`);
  }
}
```

---

### 🟠 HIGH (Fix Within 1 Month)

**4. No Cost Tracking**
- Can't calculate profit (COGS not stored)
- Analytics show revenue but not profit
- **Solution:** Add `cost_dzd` to products table, calculate profit in orders

**5. Stock Override Instead of Deduction**
- Admin updates stock with raw number (overwrites, not delta)
- No history of why stock changed
- **Solution:** Use stock movements table with audit trail

**6. No Customer Accounts**
- Everything is session-based, anonymous
- Can't build customer relationships
- **Solution:** Implement user authentication and customer profiles

---

### 🟡 MEDIUM (Fix Within 3 Months)

**7. No Inventory Audit System**
- Can't reconcile actual vs. database stock
- No way to handle shrinkage/damage
- **Solution:** Add stock count/reconciliation system

**8. No Refund/Return System**
- Orders can't be cancelled or returned
- No way to handle defective products
- **Solution:** Add refund and return order types

**9. No Batch/Expiry Tracking**
- Supplements have expiry dates, but not tracked
- Can't manage FIFO (First-In-First-Out)
- **Solution:** Add batch tracking to stock movements

---

## 7. RISK ASSESSMENT

### Data Integrity Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Overselling | **HIGH** | Angry customers, fulfillment failure | Implement atomic stock deduction |
| Stock loss | **MEDIUM** | Inventory discrepancies | Add stock movement audit trail |
| Payment disputes | **HIGH** | No proof of payment | Implement payment tracking |
| False profitability | **HIGH** | Wrong business decisions | Add cost tracking |
| Negative inventory | **MEDIUM** | System corrupted | Add constraints, validation |

### Operational Risks

| Risk | Probability | Impact |
|------|-------------|--------|
| Can't fulfill orders | **HIGH** | Customer churn, reputation damage |
| Can't calculate profit | **HIGH** | No financial visibility |
| Can't track suppliers | **MEDIUM** | No vendor relationships |
| Can't refund customers | **HIGH** | Legal/regulatory issues |
| Can't audit stock | **MEDIUM** | Unexplained shrinkage |

---

## 8. SUMMARY & RECOMMENDATIONS

### What's GOOD ✅

1. **Clean Architecture**
   - Clear separation: frontend (Next.js), backend (API routes), database (Supabase)
   - Good use of TypeScript for type safety
   - Bilingual (FR/AR) support from the start

2. **User Experience**
   - Modern UI with Radix components
   - Responsive design (mobile-first)
   - Good shopping experience (cart, checkout flow)
   - Bilingual navigation

3. **Database Schema**
   - Well-normalized (no redundancy)
   - Good use of foreign keys and constraints
   - Proper indexing for performance
   - JSONB for snapshots (good design choice)

4. **Admin Panel**
   - Dashboard with analytics
   - Product management interface
   - Order tracking
   - Multi-language support

---

### What's BAD ❌

1. **Stock Management is Broken**
   - No deduction on order
   - No audit trail
   - No reconciliation system
   - **FIX:** Implement atomic stock deductions with triggers/transactions

2. **Financial System Missing**
   - No cost tracking
   - No profit calculation
   - No payment processing
   - No refund logic
   - **FIX:** Add cost fields, payment integration, refund system

3. **No Customer Accounts**
   - Session-based (anonymous)
   - No repeat customer tracking
   - No customer history
   - **FIX:** Implement user authentication and customer profiles

4. **No Business Intelligence**
   - Can't calculate profit
   - Can't track suppliers
   - Can't forecast inventory
   - **FIX:** Add cost tracking and reporting views

---

## 9. PHASED IMPLEMENTATION ROADMAP

### PHASE 1: CRITICAL (1-2 weeks)
- [ ] Implement stock deduction on order creation
- [ ] Add stock validation at checkout
- [ ] Add database constraints (no negative stock)
- [ ] Add audit logging for stock changes
- **Result:** Stop overselling

### PHASE 2: HIGH (2-4 weeks)
- [ ] Integrate Stripe payment processing
- [ ] Add payment status tracking
- [ ] Implement refund system
- [ ] Add cost_dzd to products
- **Result:** Real payment collection + profit visibility

### PHASE 3: MEDIUM (4-8 weeks)
- [ ] Implement user authentication
- [ ] Create customer profiles
- [ ] Add customer balance tracking
- [ ] Create stock movement audit table
- **Result:** Customer relationships + inventory accountability

### PHASE 4: NICE-TO-HAVE (2-3 months)
- [ ] Supplier management system
- [ ] Batch/expiry tracking
- [ ] Stock reconciliation/count system
- [ ] Advanced reporting
- **Result:** Full ERP capability

---

## 10. CRITICAL CODE CHANGES NEEDED

### Change #1: Add Stock Deduction Trigger

```sql
CREATE OR REPLACE FUNCTION deduct_stock_on_order_item()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_available INTEGER;
BEGIN
  -- Check if enough stock exists
  SELECT stock INTO v_stock_available 
  FROM products 
  WHERE id = NEW.product_id;
  
  IF v_stock_available < NEW.qty THEN
    RAISE EXCEPTION 'Insufficient stock for product: needed %, available %', 
                    NEW.qty, v_stock_available;
  END IF;
  
  -- Deduct from products table
  UPDATE products 
  SET stock = stock - NEW.qty 
  WHERE id = NEW.product_id;
  
  -- Log the movement
  INSERT INTO stock_movements 
  (product_id, movement_type, qty_change, reference_type, reference_id, created_at)
  VALUES 
  (NEW.product_id, 'sale', -NEW.qty, 'order', NEW.order_id, NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deduct_stock_on_order_item
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION deduct_stock_on_order_item();
```

### Change #2: Add Payment Tracking

```typescript
// In checkout action:
const payment = await stripe.paymentIntents.create({
  amount: Math.round(total * 100), // Stripe uses cents
  currency: 'dzd',
});

if (payment.status !== 'succeeded') {
  return { error: 'Payment failed' };
}

const order = await createOrder({
  ...orderData,
  payment_id: payment.id,
  payment_status: 'completed', // NEW FIELD
});
```

### Change #3: Add Cost Field to Products

```sql
ALTER TABLE products ADD COLUMN cost_dzd DECIMAL(10,2) DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN cost_dzd DECIMAL(10,2) DEFAULT 0;

-- Update order admin view to show profit
SELECT 
  o.id,
  o.order_number,
  SUM(oi.line_total_dzd) as revenue,
  SUM(oi.qty * COALESCE(p.cost_dzd, 0)) as cogs,
  SUM(oi.line_total_dzd) - SUM(oi.qty * COALESCE(p.cost_dzd, 0)) as profit
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
GROUP BY o.id;
```

---

## FINAL VERDICT

**Current State:** ⚠️ **NOT PRODUCTION READY**

This system is **excellent for a demo or MVP** but will **fail immediately in real business use**:

| Use Case | Status |
|----------|--------|
| Displaying products | ✅ Works |
| Shopping cart | ✅ Works (mostly) |
| Placing orders | ✅ Works (but broken) |
| Tracking inventory | ❌ Broken |
| Calculating profit | ❌ Impossible |
| Managing stock | ❌ Manual only |
| Processing payments | ❌ Not implemented |
| Handling refunds | ❌ Not implemented |
| Running a business | ❌ Can't |

**To make it production-ready, you MUST:**

1. ✅ Fix stock deduction (CRITICAL)
2. ✅ Add payment processing (CRITICAL)
3. ✅ Add cost tracking (HIGH)
4. ✅ Add user authentication (HIGH)
5. ✅ Add audit trails (MEDIUM)

**Estimated effort:** 4-6 weeks for a competent team

---

## APPENDIX: DATABASE STATISTICS

**Tables:** 27  
**Relationships:** 35+ foreign keys  
**Indexes:** 30+  
**Constraints:** Minimal (vulnerable to bad data)  
**RLS Policies:** Minimal (limited security)  
**Triggers:** 4 (only for `updated_at`, no business logic)  

**Missing Critical Elements:**
- ❌ Stock movement tracking
- ❌ Cost/COGS management
- ❌ Payment/transaction tables
- ❌ User authentication tables
- ❌ Audit logging
- ❌ Constraint validation (stock >= 0)

---

**Report Generated:** April 21, 2026  
**System:** nutritions-store23-main  
**Architecture:** Next.js + Supabase  
**Confidence Level:** Very High (code reviewed + schema analyzed)
