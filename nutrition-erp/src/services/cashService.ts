/**
 * Cash Service
 * Single source of truth for all cash transactions and balances
 * All financial operations must record to cash_ledger
 */

import { createClient } from "@supabase/supabase-js";
import { CashSummary, CashTransaction, ApiResponse } from "../types";
import mockSupabase from "../lib/mockDatabase";

// Use mock database if credentials are placeholders (development mode)
const isDevMode =
  process.env.VITE_SUPABASE_URL?.includes("your-project") ||
  process.env.VITE_SUPABASE_ANON_KEY?.includes("your-anon-key");

const supabase = isDevMode
  ? (mockSupabase as any)
  : createClient(
      process.env.VITE_SUPABASE_URL || "",
      process.env.VITE_SUPABASE_ANON_KEY || "",
    );

/**
 * Get current cash balance (derived from ledger)
 */
export async function getCashBalance(): Promise<ApiResponse<number>> {
  try {
    const { data, error } = await supabase
      .from("cash_ledger")
      .select("balance")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return {
        success: false,
        error: error.message,
      };
    }

    const balance = data?.balance || 0;
    return {
      success: true,
      data: balance,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting cash balance: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get cash summary (inflow, outflow, balance)
 */
export async function getCashSummary(): Promise<ApiResponse<CashSummary>> {
  try {
    const { data, error } = await supabase
      .from("cash_summary")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      return {
        success: false,
        error: error.message,
      };
    }

    const summary = data || {
      total_inflow: 0,
      total_outflow: 0,
      current_balance: 0,
    };

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting cash summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get cash ledger entries for a period
 */
export async function getCashLedger(
  startDate: string,
  endDate: string,
  transactionType?: string,
): Promise<
  ApiResponse<{ transactions: CashTransaction[]; summary: CashSummary }>
> {
  try {
    let query = supabase
      .from("cash_ledger")
      .select("*")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (transactionType) {
      query = query.eq("transaction_type", transactionType);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Calculate period summary
    const periodSummary: CashSummary = {
      total_inflow: (transactions || []).reduce(
        (sum: number, t: CashTransaction) => sum + (t.debit || 0),
        0,
      ),
      total_outflow: (transactions || []).reduce(
        (sum: number, t: CashTransaction) => sum + (t.credit || 0),
        0,
      ),
      current_balance: transactions?.[transactions.length - 1]?.balance || 0,
    };

    return {
      success: true,
      data: {
        transactions: transactions || [],
        summary: periodSummary,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting cash ledger: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Initialize cash ledger with opening balance
 * Should only be called once when setting up the system
 */
export async function initializeCashLedger(
  initialBalance: number,
): Promise<ApiResponse<CashTransaction>> {
  try {
    // Check if ledger already exists
    const { count, error: countError } = await supabase
      .from("cash_ledger")
      .select("*", { count: "exact", head: true });

    if (countError) {
      return {
        success: false,
        error: `Error checking ledger: ${countError.message}`,
      };
    }

    if ((count || 0) > 0) {
      return {
        success: false,
        error: "Cash ledger already initialized",
      };
    }

    // Create initial transaction
    const { data: transaction, error } = await supabase
      .from("cash_ledger")
      .insert({
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_type: "initial_balance",
        description: "Opening balance",
        debit: initialBalance,
        credit: 0,
        balance: initialBalance,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !transaction) {
      return {
        success: false,
        error: `Failed to initialize ledger: ${error?.message}`,
      };
    }

    return {
      success: true,
      data: transaction,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error initializing ledger: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Record a cash transaction (internal use - called by sales/purchase services)
 * This is the core function - all cash changes must go through here
 */
export async function recordTransaction(
  transactionType: string,
  description: string,
  debit: number = 0,
  credit: number = 0,
  referenceType?: string,
  referenceId?: number,
): Promise<ApiResponse<CashTransaction>> {
  try {
    // Get current balance
    const currentBalance = await getCashBalance();
    const lastBalance = currentBalance.data || 0;

    // Calculate new balance
    const newBalance = lastBalance + debit - credit;

    // Validate balance doesn't go negative (optional - business rule)
    if (newBalance < 0) {
      return {
        success: false,
        error: `Insufficient cash balance. Current: ${lastBalance}, Trying to reduce by: ${credit}`,
      };
    }

    // Record transaction
    const { data: transaction, error } = await supabase
      .from("cash_ledger")
      .insert({
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_type: transactionType,
        description,
        debit,
        credit,
        reference_type: referenceType,
        reference_id: referenceId,
        balance: newBalance,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !transaction) {
      return {
        success: false,
        error: `Failed to record transaction: ${error?.message}`,
      };
    }

    return {
      success: true,
      data: transaction,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error recording transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get cash flow summary by transaction type
 */
export async function getCashFlowByType(startDate: string, endDate: string) {
  try {
    const { data: transactions, error } = await supabase
      .from("cash_ledger")
      .select("*")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Group by transaction type
    const flowByType: Record<string, { inflow: number; outflow: number }> = {};

    (transactions || []).forEach((t: CashTransaction) => {
      if (!flowByType[t.transaction_type]) {
        flowByType[t.transaction_type] = { inflow: 0, outflow: 0 };
      }
      flowByType[t.transaction_type].inflow += t.debit || 0;
      flowByType[t.transaction_type].outflow += t.credit || 0;
    });

    return {
      success: true,
      data: {
        period: `${startDate} to ${endDate}`,
        flow_by_type: flowByType,
        total_inflow: Object.values(flowByType).reduce(
          (sum: number, f) => sum + f.inflow,
          0,
        ),
        total_outflow: Object.values(flowByType).reduce(
          (sum: number, f) => sum + f.outflow,
          0,
        ),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error calculating cash flow: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get daily cash report
 */
export async function getDailyCashReport(date: string) {
  try {
    const { data: transactions, error } = await supabase
      .from("cash_ledger")
      .select("*")
      .eq("transaction_date", date)
      .order("created_at", { ascending: true });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    const totalDebit = (transactions || []).reduce(
      (sum: number, t: CashTransaction) => sum + (t.debit || 0),
      0,
    );
    const totalCredit = (transactions || []).reduce(
      (sum: number, t: CashTransaction) => sum + (t.credit || 0),
      0,
    );
    const closingBalance =
      transactions?.[transactions.length - 1]?.balance || 0;

    return {
      success: true,
      data: {
        date,
        transaction_count: transactions?.length || 0,
        total_inflow: totalDebit,
        total_outflow: totalCredit,
        net_change: totalDebit - totalCredit,
        closing_balance: closingBalance,
        transactions,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting daily report: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate all transactions balance correctly
 * Returns any discrepancies in the ledger
 */
export async function validateLedgerIntegrity() {
  try {
    const { data: allTransactions, error } = await supabase
      .from("cash_ledger")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !allTransactions) {
      return {
        success: false,
        error: error?.message || "No transactions found",
      };
    }

    let expectedBalance = 0;
    const discrepancies = [];

    for (const transaction of allTransactions) {
      expectedBalance += transaction.debit - transaction.credit;

      if (Math.abs(expectedBalance - transaction.balance) > 0.01) {
        discrepancies.push({
          transaction_id: transaction.id,
          expected_balance: expectedBalance,
          actual_balance: transaction.balance,
          difference: expectedBalance - transaction.balance,
        });
      }
    }

    return {
      success: discrepancies.length === 0,
      data: {
        total_transactions: allTransactions.length,
        discrepancy_count: discrepancies.length,
        discrepancies,
        final_balance: expectedBalance,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error validating ledger: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export default {
  getCashBalance,
  getCashSummary,
  getCashLedger,
  initializeCashLedger,
  recordTransaction,
  getCashFlowByType,
  getDailyCashReport,
  validateLedgerIntegrity,
};
