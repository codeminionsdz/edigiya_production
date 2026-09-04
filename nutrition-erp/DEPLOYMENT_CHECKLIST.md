# ✅ DEPLOYMENT CHECKLIST - Transactional Safety Implementation

## Overview
You now have a fully transactional FIFO stock deduction system with atomic operations and row-level locking. Follow this checklist to deploy safely.

---

## 📋 Pre-Deployment (Read-Only)

### 1. Review Changes
- [ ] Read `TRANSACTIONAL_IMPLEMENTATION_SUMMARY.md` (overview)
- [ ] Read `TRANSACTIONAL_SAFETY.md` (technical details)
- [ ] Read `BEFORE_AFTER_COMPARISON.md` (code changes)
- [ ] Review `SQL_REFERENCE_GUIDE.md` (function details)

### 2. Verify Environment
- [ ] PostgreSQL 11+ running (check: `SELECT version();`)
- [ ] Supabase project accessible
- [ ] Database backups current
- [ ] No ongoing database maintenance

### 3. Understand Differences
- [ ] Old function: `deductStockFIFO()` (non-transactional)
- [ ] New function: `deductStockFIFOAtomic()` (transactional)
- [ ] Location of changes: `sql/` and `src/services/`

---

## 🗄️ Database Migration (Step 1)

### A. Backup Database
- [ ] Take Supabase backup
  - Go to: Supabase > Settings > Backups > Request a backup
  - Or use: `pg_dump` if self-hosted PostgreSQL
  - Estimated time: 1-5 minutes

### B. Add PostgreSQL Functions
- [ ] Open Supabase SQL Editor
- [ ] Copy SQL from: `sql/001_create_erp_tables.sql` (lines 190-300)
  ```sql
  -- Look for:
  -- ============================================
  -- ATOMIC FIFO DEDUCTION FUNCTION
  -- ============================================
  ```
- [ ] Paste entire section into SQL Editor
- [ ] Click "Run"
- [ ] Wait for completion

### C. Verify Functions Created
- [ ] Run: `SELECT * FROM information_schema.routines WHERE routine_name = 'deduct_stock_fifo';`
  - Expected: 1 row returned
- [ ] Run: `SELECT * FROM information_schema.routines WHERE routine_name = 'get_current_cash_balance';`
  - Expected: 1 row returned
- [ ] Run test: `SELECT deduct_stock_fifo(1, 1, 1, 'order');`
  - Expected: Success response with JSON result

### D. Verify Function Permissions
- [ ] Functions should be executable by Supabase anon key
  - If needed, grant permissions:
    ```sql
    GRANT EXECUTE ON FUNCTION deduct_stock_fifo TO authenticated;
    GRANT EXECUTE ON FUNCTION get_current_cash_balance TO authenticated;
    ```

---

## 💻 Application Deployment (Step 2)

### A. Update Service Code
- [ ] Replace `src/services/salesService.ts` with new version
- [ ] Verify file has these functions:
  - [ ] `deductStockFIFOAtomic()` (new)
  - [ ] `processOrderSale()` (updated)
  - [ ] `getCurrentCashBalance()` (updated)
  - [ ] `getSalesSummary()` (unchanged)

### B. Verify TypeScript
- [ ] Run: `npm run type-check` or `tsc --noEmit`
- [ ] Expected: No errors
- [ ] Check for: `FIFODeductionResult` interface definition
  - Should be near top of salesService.ts

### C. Build & Deploy
- [ ] Build Tauri app: `npm run tauri build`
  - Or restart dev server: `npm run dev`
- [ ] Expected: Build completes without errors
- [ ] Expected: No runtime errors on startup

### D. Verify Imports
- [ ] Application imports new functions
- [ ] Check console for no import errors
- [ ] Verify service exports in `src/services/index.ts` (if updated)

---

## 🧪 Testing (Step 3)

### A. Unit Tests (if available)
- [ ] Run existing test suite: `npm run test`
- [ ] Expected: All tests pass
- [ ] Look for: No failures related to stock deduction

### B. Manual Test - Single Order
```typescript
import { processOrderSale } from '@/services';

const result = await processOrderSale(123, 5000, 'cash');
console.log(result);
// Expected: { success: true, data: { success: true, message: "Order...", details: "..." } }
```

**Verify after test:**
- [ ] stock_batches: quantities decreased ✓
- [ ] stock_movements: new entries recorded ✓
- [ ] cash_ledger: new entry created ✓
- [ ] No negative quantities ✓

### C. Manual Test - Insufficient Stock
```typescript
// Assuming product 5 has only 100 units
const result = await processOrderSale(124, 9999, 'cash');
// Expected: { success: false, error: "Stock deduction failed..." }
```

**Verify:**
- [ ] Order failed ✓
- [ ] stock_batches: unchanged ✓
- [ ] stock_movements: NO new entries (rolled back) ✓
- [ ] cash_ledger: NO new entry (rolled back) ✓

### D. Manual Test - Concurrent Orders
```typescript
// Simulate 2 orders at same time, same product
const order1 = processOrderSale(130, 5000, 'cash');
const order2 = processOrderSale(131, 5000, 'cash');

const results = await Promise.all([order1, order2]);
console.log(results);
// Expected: Both succeed (if enough stock) or at least one fails gracefully
```

**Verify:**
- [ ] No negative quantities
- [ ] All stock movements recorded
- [ ] No data corruption
- [ ] Audit trail complete

### E. Database Test - Verify Audit Trail
```sql
-- Check stock movements recorded correctly
SELECT * FROM stock_movements 
WHERE reference_type = 'order' AND reference_id IN (123, 124)
ORDER BY created_at DESC;

-- Expected: Entries for each deducted batch
-- All should be movement_type = 'out'
```

---

## 📊 Performance Testing (Step 4 - Optional)

### A. Load Test - Single Order
```typescript
import { performance } from 'perf_hooks';

for (let i = 0; i < 10; i++) {
  const start = performance.now();
  await processOrderSale(100 + i, 1000);
  const elapsed = performance.now() - start;
  console.log(`Order ${i}: ${elapsed}ms`);
}
// Expected: ~50-100ms per order (similar to before)
```

### B. Concurrency Test
```typescript
// 10 concurrent orders
const orders = Array.from({length: 10}, (_, i) => 
  processOrderSale(200 + i, 1000)
);

const start = performance.now();
const results = await Promise.all(orders);
const elapsed = performance.now() - start;

console.log(`10 orders in ${elapsed}ms`);
// Expected: ~200-500ms total (serialized by locks)
// No errors, all complete successfully
```

### C. Lock Contention Check
```sql
-- While load test running, check for lock waits:
SELECT * FROM pg_stat_activity 
WHERE wait_event IS NOT NULL;

-- Expected: Very few (if any) wait events
-- Lock wait times should be <10ms
```

---

## 🚨 Rollback Plan (If Issues)

### If Database Changes Fail
```sql
-- Drop the new functions
DROP FUNCTION IF EXISTS deduct_stock_fifo(BIGINT, BIGINT, BIGINT, VARCHAR);
DROP FUNCTION IF EXISTS get_current_cash_balance();

-- Note: No data is affected, safe to drop
```

### If Application Fails
```bash
# Revert to old code
git checkout src/services/salesService.ts

# Restart app
npm run dev
```

### If Partial Data Issues
```sql
-- Check for orphaned stock_movements
SELECT * FROM stock_movements 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Manual fixes if needed (e.g., revert specific movements)
-- Contact database admin for assistance
```

---

## ✅ Go-Live Verification

### A. Monitoring
- [ ] Monitor application logs for errors
- [ ] Monitor database logs for lock issues
- [ ] Check for failed transactions

### B. Data Integrity
- [ ] Spot-check: stock_batches quantities reasonable
- [ ] Spot-check: stock_movements entries match orders
- [ ] Spot-check: cash_ledger balance correct

### C. User Reports
- [ ] No orders stuck or timing out
- [ ] Stock levels accurate
- [ ] Payment records correct
- [ ] Audit trail complete

### D. Performance Metrics
- [ ] Order processing time: 50-100ms (expected)
- [ ] Concurrent orders: serialized safely
- [ ] No lock deadlocks
- [ ] CPU/Memory usage normal

---

## 📝 Documentation Updates

### A. Update Team Docs
- [ ] Document the new transactional system
- [ ] Share: `TRANSACTIONAL_IMPLEMENTATION_SUMMARY.md`
- [ ] Share: `SQL_REFERENCE_GUIDE.md`

### B. Update API Docs
- [ ] Update: `processOrderSale()` documentation
  - Remove: reference to old `deductStockFIFO()`
  - Add: reference to new `deductStockFIFOAtomic()`

### C. Update Runbooks
- [ ] Add: Emergency procedures for lock issues
- [ ] Add: Stock audit procedures
- [ ] Add: Concurrency testing procedures

---

## 🎓 Team Training

### A. Engineering Team
- [ ] Review: TRANSACTIONAL_SAFETY.md (15 min)
- [ ] Discuss: Row-level locking, FIFO ordering (10 min)
- [ ] Q&A: Ask questions (10 min)

### B. Operations Team
- [ ] Review: MIGRATION_GUIDE.sh (15 min)
- [ ] Practice: Running SQL migrations (10 min)
- [ ] Prepare: Rollback procedures (15 min)

### C. Product Team
- [ ] Inform: What changed and benefits
- [ ] Explain: Concurrent transaction safety
- [ ] Highlight: No user-facing changes

---

## 📅 Timeline

| Task | Estimated Time |
|------|-----------------|
| Read documentation | 30 minutes |
| Database migration | 5 minutes |
| Application deployment | 10 minutes |
| Manual testing | 30 minutes |
| Performance testing (optional) | 30 minutes |
| Verification | 20 minutes |
| Team training | 1 hour |
| **Total** | **~3 hours** |

---

## 🎯 Success Criteria

### ✅ Deployment Successful If:
- [ ] SQL functions exist and are callable
- [ ] Application builds without errors
- [ ] Single order processing works
- [ ] Concurrent orders don't cause data corruption
- [ ] No negative stock quantities
- [ ] Audit trail complete
- [ ] Performance acceptable (<100ms per order)
- [ ] Team trained and confident

### ❌ Rollback If:
- [ ] Database migration fails
- [ ] Application won't start
- [ ] Orders consistently fail
- [ ] Stock quantities go negative
- [ ] Lock deadlocks occur
- [ ] Performance degrades significantly

---

## 📞 Troubleshooting

### Problem: Function not found
```
Error: function deduct_stock_fifo() not found
```
**Solution:**
- [ ] Run SQL migration again
- [ ] Verify function created: 
  ```sql
  \df deduct_stock_fifo
  ```

### Problem: Permission denied
```
Error: permission denied for function
```
**Solution:**
- [ ] Grant execute permission:
  ```sql
  GRANT EXECUTE ON FUNCTION deduct_stock_fifo TO authenticated;
  ```

### Problem: Orders timing out
```
Error: Query timeout
```
**Solution:**
- [ ] Check for lock waits:
  ```sql
  SELECT * FROM pg_stat_activity WHERE wait_event IS NOT NULL;
  ```
- [ ] May indicate other long-running transactions
- [ ] Check database load

### Problem: Type errors in TypeScript
```
Error: Cannot find name 'FIFODeductionResult'
```
**Solution:**
- [ ] Check interface is defined in salesService.ts
- [ ] Run: `npm run type-check`

---

## 🎉 Post-Deployment

### A. Celebrate! 🚀
You now have a production-ready, transactionally-safe ERP system with:
- ✅ Atomic FIFO stock deduction
- ✅ Row-level database locking
- ✅ Concurrent transaction safety
- ✅ Impossible negative stock
- ✅ Complete audit trail

### B. Monitor
- [ ] Watch for first 24 hours
- [ ] Check error logs regularly
- [ ] Monitor database metrics

### C. Document Results
- [ ] Record: Deployment date/time
- [ ] Record: Any issues encountered
- [ ] Record: Performance metrics
- [ ] Share: Results with team

---

## 📚 Reference Files

All documentation is in: `c:\Users\codem\OneDrive\project\nutrition-erp\`

| File | Purpose |
|------|---------|
| TRANSACTIONAL_IMPLEMENTATION_SUMMARY.md | Executive summary |
| TRANSACTIONAL_SAFETY.md | Technical deep-dive |
| BEFORE_AFTER_COMPARISON.md | Code comparison |
| SQL_REFERENCE_GUIDE.md | SQL function details |
| MIGRATION_GUIDE.sh | Step-by-step guide |
| sql/001_create_erp_tables.sql | Database schema + functions |
| src/services/salesService.ts | Updated service |

---

## ✨ You're Ready!

Follow this checklist and your deployment will be smooth and safe. Good luck! 🚀
