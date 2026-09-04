/**
 * Mock Database - Local Development Support
 * Simulates Supabase responses for development without credentials
 */

// Mock data storage (in-memory for dev)
const mockData = {
  products: [
    { id: 1, name: 'Protein Powder', category_id: 1, unit_price: 45.99, sku: 'PP-001' },
    { id: 2, name: 'Vitamins', category_id: 2, unit_price: 25.50, sku: 'VT-001' },
    { id: 3, name: 'Amino Acids', category_id: 1, unit_price: 55.00, sku: 'AA-001' },
  ],
  stock_batches: [
    { id: 1, product_id: 1, batch_number: 'BATCH-001', quantity_available: 100, unit_cost: 30 },
    { id: 2, product_id: 2, batch_number: 'BATCH-002', quantity_available: 50, unit_cost: 15 },
  ],
  cash_ledger: [
    { id: 1, transaction_type: 'sale', amount: 500, balance: 500, created_at: new Date().toISOString() },
  ],
  suppliers: [
    { id: 1, name: 'Global Nutrition Inc', email: 'sales@globalnutrition.com', is_active: true },
  ],
  purchases: [],
  orders: [],
};

export const mockSupabase = {
  from: (table: string) => ({
    select: (query: string = '*') => ({
      data: mockData[table as keyof typeof mockData] || [],
      error: null,
      status: 200,
      statusText: 'OK',
    }),
    insert: (data: any) => ({
      data: data,
      error: null,
      status: 201,
      statusText: 'Created',
    }),
    update: (data: any) => ({
      eq: (field: string, value: any) => ({
        data: data,
        error: null,
        status: 200,
        statusText: 'OK',
      }),
    }),
    delete: () => ({
      eq: (field: string, value: any) => ({
        data: null,
        error: null,
        status: 204,
        statusText: 'No Content',
      }),
    }),
  }),
  rpc: (functionName: string, params?: any) => {
    // Mock RPC functions
    if (functionName === 'deduct_stock_fifo') {
      return Promise.resolve({
        data: {
          success: true,
          message: 'Stock deducted successfully',
          total_deducted: params?.quantity || 10,
          batches_used: [
            {
              batch_id: 1,
              batch_number: 'BATCH-001',
              quantity_deducted: params?.quantity || 10,
              unit_cost: 30,
            },
          ],
        },
        error: null,
      });
    }
    if (functionName === 'get_current_cash_balance') {
      return Promise.resolve({
        data: 5000,
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  },
};

export default mockSupabase;
