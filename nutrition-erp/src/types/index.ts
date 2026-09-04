/**
 * ERP System Type Definitions
 * Core types for suppliers, purchases, stock, and cash management
 */

// ============================================
// SUPPLIER TYPES
// ============================================
export interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  payment_terms?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateSupplierInput = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;
export type UpdateSupplierInput = Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>;

// ============================================
// PURCHASE TYPES
// ============================================
export type PurchaseStatus = 'pending' | 'received' | 'partial' | 'cancelled';

export interface Purchase {
  id: number;
  purchase_number: string;
  supplier_id: number;
  purchase_date: string; // DATE
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  total_amount: number;
  tax_amount?: number;
  status: PurchaseStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseWithSupplier extends Purchase {
  supplier?: Supplier;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[];
  supplier?: Supplier;
}

export type CreatePurchaseInput = Omit<Purchase, 'id' | 'created_at' | 'updated_at' | 'total_amount'>;
export type CreatePurchaseItemInput = Omit<PurchaseItem, 'id' | 'created_at' | 'updated_at' | 'total_cost'>;

// ============================================
// STOCK TYPES
// ============================================
export interface StockBatch {
  id: number;
  product_id: number;
  batch_number: string;
  purchase_item_id?: number;
  quantity_received: number;
  quantity_available: number;
  unit_cost: number;
  received_date: string; // DATE
  expiry_date?: string;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'in' | 'out' | 'adjustment' | 'damage' | 'return';
export type ReferenceType = 'purchase' | 'order' | 'adjustment';

export interface StockMovement {
  id: number;
  product_id: number;
  batch_id?: number;
  movement_type: MovementType;
  quantity: number;
  reference_type?: ReferenceType;
  reference_id?: number;
  notes?: string;
  created_at: string;
}

export interface StockLevel {
  product_id: number;
  total_quantity: number;
  batch_count: number;
  oldest_batch_date?: string;
  newest_batch_date?: string;
}

export type CreateStockMovementInput = Omit<StockMovement, 'id' | 'created_at'>;

// ============================================
// EXPENSE TYPES
// ============================================
export interface Expense {
  id: number;
  expense_date: string; // DATE
  category: string;
  description: string;
  amount: number;
  payment_method?: string;
  reference_id?: number;
  reference_type?: string;
  approved: boolean;
  approved_by?: number;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export type CreateExpenseInput = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'approved' | 'approved_by' | 'approved_at'>;

// ============================================
// CASH LEDGER TYPES
// ============================================
export type TransactionType = 'sale' | 'purchase' | 'expense' | 'payment_received' | 'payment_made' | 'initial_balance';

export interface CashTransaction {
  id: number;
  transaction_date: string; // DATE
  transaction_type: TransactionType;
  description: string;
  debit: number; // Cash in
  credit: number; // Cash out
  reference_type?: ReferenceType;
  reference_id?: number;
  balance: number; // Running balance
  created_at: string;
}

export interface CashSummary {
  total_inflow: number;
  total_outflow: number;
  current_balance: number;
}

export type CreateCashTransactionInput = Omit<CashTransaction, 'id' | 'created_at' | 'balance'>;

// ============================================
// API RESPONSE TYPES
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
