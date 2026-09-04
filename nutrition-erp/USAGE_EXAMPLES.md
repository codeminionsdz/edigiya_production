/**
 * USAGE EXAMPLES
 * Real-world scenarios for using the ERP services
 */

// ============================================
// SCENARIO 1: NEW SUPPLIER & PURCHASE ORDER
// ============================================

import {
  purchaseService,
  stockService,
  cashService,
} from '@/services';

async function example_newPurchaseWorkflow() {
  try {
    // 1. Create purchase order from supplier
    const purchaseResult = await purchaseService.createPurchase(
      {
        supplier_id: 1,
        purchase_date: '2024-04-21',
        expected_delivery_date: '2024-04-25',
        status: 'pending',
      },
      [
        {
          product_id: 5, // Existing product from e-commerce DB
          quantity_ordered: 100,
          unit_cost: 50, // Cost per unit from supplier
        },
        {
          product_id: 8,
          quantity_ordered: 50,
          unit_cost: 120,
        },
      ]
    );

    if (!purchaseResult.success) {
      console.error('Failed to create purchase:', purchaseResult.error);
      return;
    }

    const purchase = purchaseResult.data;
    console.log(`Purchase #${purchase.purchase_number} created`);

    // 2. Stock arrives from supplier
    await purchaseService.receiveStock(purchase.id, [
      {
        purchase_item_id: 1,
        product_id: 5,
        quantity_received: 100,
        batch_number: 'BATCH-20240421-001', // Unique batch identifier
        unit_cost: 50,
        received_date: '2024-04-22',
        expiry_date: '2025-04-22', // Optional, for perishables
      },
      {
        purchase_item_id: 2,
        product_id: 8,
        quantity_received: 50,
        batch_number: 'BATCH-20240421-002',
        unit_cost: 120,
        received_date: '2024-04-22',
      },
    ]);

    console.log('Stock received and batches created');

    // 3. Check stock levels
    const stock5 = await stockService.getStockLevel(5);
    const stock8 = await stockService.getStockLevel(8);

    console.log(`Product 5: ${stock5.data?.total_quantity} units`);
    console.log(`Product 8: ${stock8.data?.total_quantity} units`);

    // 4. Pay for purchase
    const paymentResult = await purchaseService.processPurchasePayment(
      purchase.id,
      100 * 50 + 50 * 120, // Total cost
      'bank_transfer'
    );

    if (paymentResult.success) {
      console.log(paymentResult.data?.message);
    }

    // 5. Check cash balance after payment
    const balance = await cashService.getCashBalance();
    console.log(`Current cash balance: ${balance.data}`);
  } catch (error) {
    console.error('Error in purchase workflow:', error);
  }
}

// ============================================
// SCENARIO 2: PROCESSING A SALE (Order Fulfillment)
// ============================================

import { salesService } from '@/services';

async function example_processSaleWorkflow() {
  try {
    // 1. Order placed by customer (created in existing orders table)
    // Assume order #123 has:
    // - order_items: [{ product_id: 5, quantity: 25 }, { product_id: 8, quantity: 10 }]

    const orderId = 123;
    const totalAmount = 5000; // Total order value

    // 2. Process sale (stock deduction + cash recording)
    const saleResult = await salesService.processOrderSale(
      orderId,
      totalAmount,
      'cash' // or 'credit_card', 'bank_transfer'
    );

    if (saleResult.success) {
      console.log('Order processed successfully');
      console.log('- Stock deducted using FIFO');
      console.log('- Cash recorded in ledger');
      console.log('- Stock movements logged');
    } else {
      console.error('Failed to process order:', saleResult.error);
      // Possible error: insufficient stock
    }

    // 3. Check stock levels after sale
    const stock5After = await salesService.deductStockFIFO(5, 0);
    // Note: Just checking, quantity is 0 (no actual deduction)

    // 4. Check daily sales
    const today = new Date().toISOString().split('T')[0];
    const salesSummary = await salesService.getSalesSummary(today, today);
    console.log(`Today's sales: ${salesSummary.data?.total_sales}`);
    console.log(`Transactions: ${salesSummary.data?.transaction_count}`);
  } catch (error) {
    console.error('Error processing sale:', error);
  }
}

// ============================================
// SCENARIO 3: STOCK MANAGEMENT & TRACKING
// ============================================

async function example_stockManagement() {
  try {
    // 1. Get all available batches for a product (FIFO order)
    const batches = await stockService.getProductBatches(5);
    console.log('Available batches for product 5:');
    batches.data?.forEach((batch) => {
      console.log(`  - Batch ${batch.batch_number}: ${batch.quantity_available} units`);
      console.log(`    Received: ${batch.received_date}, Cost: $${batch.unit_cost}/unit`);
    });

    // 2. Get movement history
    const history = await stockService.getStockHistory(
      5,
      '2024-04-01',
      '2024-04-30'
    );
    console.log(`\nStock movements in April:`);
    history.data?.movements?.forEach((movement) => {
      console.log(`  ${movement.created_at}: ${movement.movement_type} ${movement.quantity}`);
    });

    // 3. Check for low stock
    const lowStock = await stockService.getLowStockProducts(20);
    console.log(`\nProducts with less than 20 units:`);
    lowStock.data?.products?.forEach((p) => {
      console.log(`  Product ${p.product_id}: ${p.total_quantity} units`);
    });

    // 4. Record damage/loss
    const adjustmentResult = await stockService.recordStockAdjustment(
      5,
      5, // 5 units damaged
      'Warehouse damage',
      'Water damage in storage area'
    );
    console.log(adjustmentResult.data?.message);

    // 5. Get total inventory value
    const value = await stockService.getStockValue();
    console.log(`\nTotal inventory value: $${value.data?.total_value}`);
    console.log(`Total units: ${value.data?.total_units}`);
    console.log(`Average cost per unit: $${value.data?.average_unit_cost}`);

    // 6. Check for expiring stock
    const expiring = await stockService.getExpiringStock(30); // Expiring in 30 days
    console.log(`\nBatches expiring within 30 days:`);
    expiring.data?.batches?.forEach((batch) => {
      console.log(`  Batch ${batch.batch_number}: Expires ${batch.expiry_date}`);
    });
  } catch (error) {
    console.error('Error in stock management:', error);
  }
}

// ============================================
// SCENARIO 4: FINANCIAL REPORTING
// ============================================

async function example_financialReporting() {
  try {
    // 1. Current cash balance
    const balance = await cashService.getCashBalance();
    console.log(`Current cash on hand: $${balance.data}`);

    // 2. Cash summary (total inflow, outflow, balance)
    const summary = await cashService.getCashSummary();
    console.log(`\nCash Summary:`);
    console.log(`  Total inflow (sales): $${summary.data?.total_inflow}`);
    console.log(`  Total outflow (purchases + expenses): $${summary.data?.total_outflow}`);
    console.log(`  Current balance: $${summary.data?.current_balance}`);

    // 3. Cash ledger for April
    const ledger = await cashService.getCashLedger('2024-04-01', '2024-04-30');
    console.log(`\nApril Transactions:`);
    ledger.data?.transactions?.forEach((t) => {
      const type = t.debit > 0 ? 'IN' : 'OUT';
      const amount = t.debit > 0 ? t.debit : t.credit;
      console.log(`  ${t.transaction_date} [${type}] $${amount} - ${t.description}`);
    });

    // 4. Cash flow by transaction type
    const flow = await cashService.getCashFlowByType('2024-04-01', '2024-04-30');
    console.log(`\nCash Flow by Type (April):`);
    Object.entries(flow.data?.flow_by_type || {}).forEach(([type, data]: any) => {
      console.log(`  ${type}:`);
      console.log(`    Inflow: $${data.inflow}`);
      console.log(`    Outflow: $${data.outflow}`);
    });

    // 5. Daily cash report
    const today = new Date().toISOString().split('T')[0];
    const daily = await cashService.getDailyCashReport(today);
    console.log(`\n${today} Cash Report:`);
    console.log(`  Transactions: ${daily.data?.transaction_count}`);
    console.log(`  Inflow: $${daily.data?.total_inflow}`);
    console.log(`  Outflow: $${daily.data?.total_outflow}`);
    console.log(`  Net change: $${daily.data?.net_change}`);
    console.log(`  Closing balance: $${daily.data?.closing_balance}`);

    // 6. Verify ledger integrity
    const integrity = await cashService.validateLedgerIntegrity();
    if (integrity.success) {
      console.log('\n✓ Cash ledger is balanced');
    } else {
      console.log('\n⚠ Discrepancies found:');
      integrity.data?.discrepancies?.forEach((d: any) => {
        console.log(`  Transaction ${d.transaction_id}: Difference of $${d.difference}`);
      });
    }
  } catch (error) {
    console.error('Error in financial reporting:', error);
  }
}

// ============================================
// SCENARIO 5: EXPENSE TRACKING (Future Implementation)
// ============================================

async function example_expenseTracking() {
  // Note: Expense recording would be implemented as:

  // 1. Record expense
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      expense_date: '2024-04-21',
      category: 'shipping',
      description: 'Courier fee for Purchase #PO20240421001',
      amount: 500,
      payment_method: 'credit_card',
      reference_id: 1, // purchase_id
      reference_type: 'purchase',
    })
    .select()
    .single();

  // 2. Record cash outflow
  if (!error) {
    await cashService.recordTransaction(
      'expense',
      `Shipping cost - Purchase #PO20240421001`,
      0, // no debit
      500, // credit (outflow)
      'purchase',
      1 // purchase_id
    );
  }
}

export {
  example_newPurchaseWorkflow,
  example_processSaleWorkflow,
  example_stockManagement,
  example_financialReporting,
  example_expenseTracking,
};
