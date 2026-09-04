-- ERP Extension Schema
-- New tables to support stock management, purchases, and cash tracking
-- These tables extend the existing e-commerce database (products, orders, etc.)

-- ============================================
-- 1. SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  payment_terms VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);

-- ============================================
-- 2. PURCHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY,
  purchase_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_date DATE NOT NULL,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, received, partial, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX idx_purchases_purchase_number ON purchases(purchase_number);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_purchase_date ON purchases(purchase_date);

-- ============================================
-- 3. PURCHASE_ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_ordered BIGINT NOT NULL,
  quantity_received BIGINT DEFAULT 0,
  unit_cost DECIMAL(15, 2) NOT NULL,
  total_cost DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product_id ON purchase_items(product_id);

-- ============================================
-- 4. STOCK_BATCHES TABLE (FIFO tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_batches (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_number VARCHAR(100) NOT NULL,
  purchase_item_id BIGINT REFERENCES purchase_items(id) ON DELETE SET NULL,
  quantity_received BIGINT NOT NULL,
  quantity_available BIGINT NOT NULL,
  unit_cost DECIMAL(15, 2) NOT NULL,
  received_date DATE NOT NULL,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_batches_product_id ON stock_batches(product_id);
CREATE INDEX idx_stock_batches_received_date ON stock_batches(received_date);
CREATE INDEX idx_stock_batches_quantity_available ON stock_batches(quantity_available) WHERE quantity_available > 0;

-- ============================================
-- 5. STOCK_MOVEMENTS TABLE (Audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id BIGINT REFERENCES stock_batches(id) ON DELETE SET NULL,
  movement_type VARCHAR(50) NOT NULL, -- 'in' (purchase), 'out' (sales), 'adjustment', 'damage', 'return'
  quantity BIGINT NOT NULL,
  reference_type VARCHAR(50), -- 'purchase', 'order', 'adjustment'
  reference_id BIGINT, -- purchase_id or order_id
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_batch_id ON stock_movements(batch_id);
CREATE INDEX idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

-- ============================================
-- 6. EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  expense_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'shipping', 'utilities', 'rent', 'wages', 'supplies', etc.
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash', 'bank_transfer', 'credit_card'
  reference_id BIGINT, -- links to purchase_id if related
  reference_type VARCHAR(50), -- 'purchase', 'invoice', 'other'
  approved BOOLEAN DEFAULT FALSE,
  approved_by BIGINT REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_approved ON expenses(approved);

-- ============================================
-- 7. CASH_LEDGER TABLE (Single source of truth for cash)
-- ============================================
CREATE TABLE IF NOT EXISTS cash_ledger (
  id BIGSERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'sale', 'purchase', 'expense', 'payment_received', 'payment_made', 'initial_balance'
  description TEXT NOT NULL,
  debit DECIMAL(15, 2) DEFAULT 0, -- Cash in
  credit DECIMAL(15, 2) DEFAULT 0, -- Cash out
  reference_type VARCHAR(50), -- 'order', 'purchase', 'expense'
  reference_id BIGINT, -- order_id, purchase_id, expense_id
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Running balance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_ledger_transaction_date ON cash_ledger(transaction_date);
CREATE INDEX idx_cash_ledger_transaction_type ON cash_ledger(transaction_type);
CREATE INDEX idx_cash_ledger_reference ON cash_ledger(reference_type, reference_id);

-- ============================================
-- MATERIALIZED VIEWS FOR REPORTING
-- ============================================

-- Current stock levels (derived from batches)
CREATE OR REPLACE VIEW stock_levels AS
SELECT 
  product_id,
  SUM(quantity_available) as total_quantity,
  COUNT(DISTINCT id) as batch_count,
  MIN(received_date) as oldest_batch_date,
  MAX(received_date) as newest_batch_date
FROM stock_batches
WHERE quantity_available > 0
GROUP BY product_id;

-- Cash balance
CREATE OR REPLACE VIEW cash_summary AS
SELECT 
  COALESCE(SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END), 0) as total_inflow,
  COALESCE(SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END), 0) as total_outflow,
  COALESCE(MAX(balance), 0) as current_balance
FROM cash_ledger;

-- Purchase summary
CREATE OR REPLACE VIEW purchase_summary AS
SELECT 
  p.id,
  p.purchase_number,
  s.name as supplier_name,
  p.purchase_date,
  p.total_amount,
  p.status,
  SUM(CASE WHEN pi.quantity_received > 0 THEN pi.quantity_received ELSE 0 END) as items_received,
  COUNT(pi.id) as total_items
FROM purchases p
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
GROUP BY p.id, p.purchase_number, s.name, p.purchase_date, p.total_amount, p.status;

-- ============================================
-- ATOMIC FIFO DEDUCTION FUNCTION
-- Safe for concurrent transactions with row-level locking
-- ============================================

CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_product_id BIGINT,
  p_quantity_needed BIGINT,
  p_order_id BIGINT,
  p_reference_type VARCHAR DEFAULT 'order'
)
RETURNS TABLE (
  success BOOLEAN,
  message VARCHAR,
  total_deducted BIGINT,
  batches_used JSONB
) AS $$
DECLARE
  v_total_available BIGINT;
  v_total_deducted BIGINT := 0;
  v_batches_used JSONB := '[]'::JSONB;
  v_batch RECORD;
  v_quantity_to_deduct BIGINT;
  v_error_message VARCHAR;
BEGIN
  -- Check total available stock with lock
  SELECT COALESCE(SUM(quantity_available), 0)
  INTO v_total_available
  FROM stock_batches
  WHERE product_id = p_product_id AND quantity_available > 0;

  -- Validate sufficient stock
  IF v_total_available < p_quantity_needed THEN
    RETURN QUERY SELECT 
      FALSE,
      'Insufficient stock. Need ' || p_quantity_needed || ', but only ' || v_total_available || ' available.',
      0,
      '[]'::JSONB;
    RETURN;
  END IF;

  -- Process FIFO deduction with row-level locking
  FOR v_batch IN
    SELECT id, batch_number, quantity_available, unit_cost
    FROM stock_batches
    WHERE product_id = p_product_id AND quantity_available > 0
    ORDER BY received_date ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_total_deducted >= p_quantity_needed;

    v_quantity_to_deduct := LEAST(v_batch.quantity_available, p_quantity_needed - v_total_deducted);

    -- Update batch quantity
    UPDATE stock_batches
    SET quantity_available = quantity_available - v_quantity_to_deduct,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_batch.id;

    -- Record stock movement
    INSERT INTO stock_movements (
      product_id,
      batch_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      created_at
    ) VALUES (
      p_product_id,
      v_batch.id,
      'out'::VARCHAR,
      v_quantity_to_deduct,
      p_reference_type,
      p_order_id,
      'FIFO deduction - Batch: ' || v_batch.batch_number || ' | Qty: ' || v_quantity_to_deduct,
      CURRENT_TIMESTAMP
    );

    -- Accumulate deducted quantity
    v_total_deducted := v_total_deducted + v_quantity_to_deduct;

    -- Add to batches_used JSON array
    v_batches_used := v_batches_used || jsonb_build_object(
      'batch_id', v_batch.id,
      'batch_number', v_batch.batch_number,
      'quantity_deducted', v_quantity_to_deduct,
      'unit_cost', v_batch.unit_cost
    );
  END LOOP;

  -- Return success
  RETURN QUERY SELECT 
    TRUE,
    'Stock deducted successfully. ' || v_total_deducted || ' units from ' || jsonb_array_length(v_batches_used) || ' batches.',
    v_total_deducted,
    v_batches_used;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    FALSE,
    'Database error: ' || SQLERRM,
    0,
    '[]'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BATCH CASH BALANCE CALCULATION
-- Gets current balance safely
-- ============================================

CREATE OR REPLACE FUNCTION get_current_cash_balance()
RETURNS DECIMAL AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  SELECT COALESCE(balance, 0)
  INTO v_balance
  FROM cash_ledger
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;
