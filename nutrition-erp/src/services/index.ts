/**
 * Services Index
 * Central export point for all ERP services
 */

export { default as salesService } from './salesService';
export { default as purchaseService } from './purchaseService';
export { default as stockService } from './stockService';
export { default as cashService } from './cashService';

// Re-export commonly used functions
export { processOrderSale, getSalesSummary } from './salesService';
export { createPurchase, receiveStock, processPurchasePayment, getPurchaseSummary } from './purchaseService';
export {
  getStockLevel,
  getProductBatches,
  recordStockAdjustment,
  getStockHistory,
  getLowStockProducts,
  getStockValue,
  getExpiringStock,
} from './stockService';
export {
  getCashBalance,
  getCashSummary,
  getCashLedger,
  initializeCashLedger,
  recordTransaction,
  getCashFlowByType,
  getDailyCashReport,
  validateLedgerIntegrity,
} from './cashService';
