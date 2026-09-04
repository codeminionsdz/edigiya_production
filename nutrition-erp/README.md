# ERP System Architecture

## Overview
This is a desktop ERP system built with Tauri + React that extends an existing Supabase PostgreSQL database with comprehensive stock management, purchasing, and cash tracking capabilities.

**Important:** This is a completely separate system from the existing e-commerce website. No modifications to existing tables (products, orders, categories, brands).

---

## Database Schema

### New Tables Created

#### 1. **suppliers**
Stores supplier information for purchases.
```sql
- id (PK)
- name, email, phone, address, city, country
- payment_terms
- is_active
- timestamps
```

#### 2. **purchases**
Main purchase order records.
```sql
- id (PK)
- purchase_number (unique, auto-generated)
- supplier_id (FK)
- purchase_date, expected_delivery_date, actual_delivery_date
- total_amount, tax_amount
- status: 'pending' | 'received' | 'partial' | 'cancelled'
- timestamps
```

#### 3. **purchase_items**
Individual items in a purchase order.
```sql
- id (PK)
- purchase_id (FK)
- product_id (FK to existing products table)
- quantity_ordered, quantity_received
- unit_cost, total_cost
- timestamps
```

#### 4. **stock_batches** ⭐ FIFO Tracking
Tracks inventory in batches for FIFO deduction and traceability.
```sql
- id (PK)
- product_id (FK)
- batch_number (unique identifier)
- purchase_item_id (FK, optional link to purchase)
- quantity_received, quantity_available
- unit_cost (purchase price)
- received_date, expiry_date
- timestamps
```

#### 5. **stock_movements** 📊 Audit Trail
Complete audit trail of all inventory movements.
```sql
- id (PK)
- product_id (FK)
- batch_id (FK, optional)
- movement_type: 'in' | 'out' | 'adjustment' | 'damage' | 'return'
- quantity
- reference_type: 'purchase' | 'order' | 'adjustment'
- reference_id (links to purchase_id or order_id)
- notes
- created_at (immutable timestamp)
```

#### 6. **expenses**
Track all business expenses.
```sql
- id (PK)
- expense_date
- category (shipping, utilities, rent, wages, supplies, etc.)
- description, amount
- payment_method
- reference_id, reference_type (optional link to purchase)
- approved, approved_by, approved_at
- timestamps
```

#### 7. **cash_ledger** 💰 Single Source of Truth
All cash transactions recorded here. Balance is **derived**, not stored.
```sql
- id (PK)
- transaction_date
- transaction_type: 'sale' | 'purchase' | 'expense' | 'payment_received' | 'payment_made' | 'initial_balance'
- description
- debit (cash in), credit (cash out)
- reference_type, reference_id
- balance (running balance - calculated field)
- created_at (immutable)
```

### Materialized Views

```sql
stock_levels          -- Current inventory per product
cash_summary          -- Total inflow, outflow, balance
purchase_summary      -- Purchase order summaries with status
```

---

## Service Layer Architecture

### 1. **salesService.ts**
Handles order fulfillment and cash collection.

**Key Functions:**
- `processOrderSale(orderId, totalAmount)` - Process completed sale
  - Deducts stock using FIFO
  - Records stock movements
  - Records cash inflow to ledger
  
- `deductStockFIFO(productId, quantity)` - Core FIFO logic
  - Gets available batches ordered by received_date
  - Deducts oldest stock first
  - Returns batches used
  
- `getSalesSummary(startDate, endDate)` - Sales analytics

**Example Usage:**
```typescript
import { salesService } from '@/services';

await salesService.processOrderSale(
  orderId: 123,
  totalAmount: 5000,
  paymentMethod: 'cash'
);
```

### 2. **purchaseService.ts**
Handles supplier purchases and stock intake.

**Key Functions:**
- `createPurchase(input, items)` - Create purchase order
  - Auto-generates purchase_number
  - Calculates total_amount
  
- `receiveStock(purchaseId, items)` - Receive stock from supplier
  - Creates stock_batches
  - Records stock movements (in)
  - Updates purchase status
  
- `processPurchasePayment(purchaseId, amount)` - Pay for purchase
  - Validates cash balance
  - Records cash outflow
  
- `getPurchaseSummary(startDate, endDate)` - Purchase analytics

**Example Usage:**
```typescript
import { purchaseService } from '@/services';

// Create PO
const purchase = await purchaseService.createPurchase(
  { supplier_id: 1, purchase_date: '2024-04-21' },
  [{ product_id: 5, quantity_ordered: 100, unit_cost: 50 }]
);

// Receive stock
await purchaseService.receiveStock(purchase.id, [
  {
    purchase_item_id: 1,
    product_id: 5,
    quantity_received: 100,
    batch_number: 'BATCH-001',
    unit_cost: 50,
    received_date: '2024-04-21'
  }
]);

// Pay for purchase
await purchaseService.processPurchasePayment(purchase.id, 5000, 'bank_transfer');
```

### 3. **stockService.ts**
Manages inventory levels and FIFO batching.

**Key Functions:**
- `getStockLevel(productId)` - Get current stock (from stock_levels view)
- `getProductBatches(productId)` - Get available batches in FIFO order
- `recordStockAdjustment(productId, quantity, reason)` - Adjust for damage/loss
- `getStockHistory(productId, startDate, endDate)` - Movement audit trail
- `getLowStockProducts(threshold)` - Find low inventory
- `getStockValue()` - Total inventory value at cost
- `getExpiringStock(daysUntilExpiry)` - Find expiring batches

**Example Usage:**
```typescript
import { stockService } from '@/services';

// Check stock level
const level = await stockService.getStockLevel(5);
// Returns: { product_id: 5, total_quantity: 250, batch_count: 3 }

// Get FIFO batches
const batches = await stockService.getProductBatches(5);
// Ordered by received_date (oldest first)

// Record damage
await stockService.recordStockAdjustment(
  productId: 5,
  quantity: 10,
  reason: 'Damaged in warehouse',
  notes: 'Box was crushed'
);
```

### 4. **cashService.ts**
Single source of truth for cash management.

**Key Functions:**
- `getCashBalance()` - Get current cash (from last ledger entry)
- `getCashSummary()` - Get total inflow, outflow, balance
- `getCashLedger(startDate, endDate, type?)` - Get all transactions in period
- `initializeCashLedger(amount)` - Set opening balance (call once)
- `recordTransaction(type, description, debit, credit)` - Core function (used by other services)
- `getCashFlowByType(startDate, endDate)` - Group by transaction type
- `getDailyCashReport(date)` - Daily cash summary
- `validateLedgerIntegrity()` - Check for balance discrepancies

**Example Usage:**
```typescript
import { cashService } from '@/services';

// Check current balance
const balance = await cashService.getCashBalance();
// Returns: 50000 (number)

// Get period summary
const ledger = await cashService.getCashLedger('2024-04-01', '2024-04-30');
// Returns: { transactions: [...], summary: { total_inflow, total_outflow, current_balance } }

// Initialize system (once only)
await cashService.initializeCashLedger(100000);
```

---

## Data Flow & Business Logic

### Sale Workflow
```
1. Order placed → (existing order_items created)
2. Order marked as complete
3. processOrderSale() called:
   ├─ Get order with items
   ├─ deductStockFIFO() for each item:
   │  ├─ Query batches ordered by received_date
   │  ├─ Deduct quantity from each batch (oldest first)
   │  └─ Update batch.quantity_available
   ├─ Record stock_movements (type='out')
   ├─ Record cash_ledger (transaction_type='sale', debit=amount)
   └─ Return success/error
```

### Purchase Workflow
```
1. createPurchase() with items:
   ├─ Generate purchase_number
   ├─ Insert to purchases table
   ├─ Insert to purchase_items with calculated total_cost
   └─ Return purchase record

2. receiveStock() when stock arrives:
   ├─ Create stock_batches for each item:
   │  ├─ Set quantity_received = quantity_available
   │  └─ Store unit_cost
   ├─ Record stock_movements (type='in')
   ├─ Update purchase_items.quantity_received
   ├─ Update purchase.status (received/partial/pending)
   └─ Return created batches

3. processPurchasePayment():
   ├─ Validate cash balance
   ├─ Calculate new balance = current - amount
   ├─ Record cash_ledger (transaction_type='payment_made', credit=amount)
   └─ Return success with new balance
```

### Stock Deduction (FIFO)
```
deductStockFIFO(product_id=5, quantity=100):
  ├─ Query stock_batches WHERE product_id=5 AND quantity_available > 0
  │  ORDER BY received_date ASC
  └─ Iterate batches:
     ├─ Deduct min(batch.quantity_available, remaining)
     ├─ Update batch.quantity_available
     └─ Record in stock_movements
```

### Cash Ledger
```
All financial changes flow through cash_ledger:
- Sales → debit (cash in)
- Purchases → credit (cash out)
- Expenses → credit (cash out)
- Current balance = MAX(balance) from all transactions
```

---

## Important Rules

### ✅ DO
- ✅ Use FIFO for stock deduction (oldest batches first)
- ✅ Record **every** cash transaction in cash_ledger
- ✅ Maintain stock_movements audit trail (never delete)
- ✅ Link all transactions via reference_id + reference_type
- ✅ Validate cash balance before payments
- ✅ Create stock_batches with batch_number for traceability

### ❌ DON'T
- ❌ Modify existing tables (products, orders, categories, brands)
- ❌ Store balance in any table except cash_ledger
- ❌ Deduct stock directly (only through deductStockFIFO)
- ❌ Delete records from stock_movements or cash_ledger
- ❌ Process payments without cash_ledger entry
- ❌ Create stock_batches without batch_number

---

## Type Safety

All TypeScript types are in `src/types/index.ts`:

```typescript
// Supplier types
Supplier, CreateSupplierInput, UpdateSupplierInput

// Purchase types
Purchase, PurchaseItem, PurchaseWithItems, CreatePurchaseInput

// Stock types
StockBatch, StockLevel, StockMovement, MovementType

// Expense types
Expense, CreateExpenseInput

// Cash types
CashTransaction, CashSummary, TransactionType

// API responses
ApiResponse<T>, PaginatedResponse<T>
```

---

## File Structure

```
nutrition-erp/
├── sql/
│   └── 001_create_erp_tables.sql     # SQL schema (new tables only)
├── src/
│   ├── types/
│   │   └── index.ts                  # TypeScript type definitions
│   └── services/
│       ├── index.ts                  # Service exports
│       ├── salesService.ts           # Order fulfillment & sales
│       ├── purchaseService.ts        # Supplier purchases & stock intake
│       ├── stockService.ts           # Inventory management
│       └── cashService.ts            # Cash ledger & financial tracking
└── README.md                         # This file
```

---

## Quick Start

### 1. Run SQL Migration
Execute `sql/001_create_erp_tables.sql` in Supabase SQL Editor.

### 2. Initialize Cash Ledger
```typescript
import { cashService } from '@/services';

await cashService.initializeCashLedger(100000); // Set opening balance
```

### 3. Use in Components
```typescript
import { 
  processOrderSale,
  createPurchase,
  getStockLevel,
  getCashBalance
} from '@/services';

// Get cash balance
const balance = await getCashBalance();

// Get stock level
const stock = await getStockLevel(5);

// Create purchase
const purchase = await createPurchase(input, items);

// Process sale
await processOrderSale(orderId, totalAmount);
```

---

## Reporting

The system supports various reports:

- **Sales Summary** → salesService.getSalesSummary()
- **Purchase Summary** → purchaseService.getPurchaseSummary()
- **Stock Levels** → query stock_levels view
- **Stock History** → stockService.getStockHistory()
- **Low Stock** → stockService.getLowStockProducts()
- **Stock Value** → stockService.getStockValue()
- **Cash Balance** → cashService.getCashBalance()
- **Cash Flow by Type** → cashService.getCashFlowByType()
- **Daily Cash Report** → cashService.getDailyCashReport()
- **Ledger Integrity** → cashService.validateLedgerIntegrity()

---

## Notes

- All timestamps are stored in UTC (TIMESTAMP WITH TIME ZONE)
- Dates (DATE type) are stored without time component
- Stock deduction is FIFO: older batches are used first
- Cash balance is derived from ledger (no redundant storage)
- All operations are traceable via reference_id + reference_type
- Stock movements are immutable (created_at only, no updates/deletes)
- Complete separation from existing e-commerce system
