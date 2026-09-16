/**
 * Purchase Service
 * Handles supplier purchases, stock receipt, and cash outflows
 */

import { createClient } from "@supabase/supabase-js";
import {
  Purchase,
  PurchaseItem,
  CreatePurchaseInput,
  CreatePurchaseItemInput,
  StockBatch,
  ApiResponse,
} from "../types";
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
 * Create a new purchase order
 */
export async function createPurchase(
  input: CreatePurchaseInput,
  items: CreatePurchaseItemInput[],
): Promise<ApiResponse<Purchase>> {
  try {
    // Generate unique purchase number
    const purchaseNumber = await generatePurchaseNumber();

    // Insert purchase
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        ...input,
        purchase_number: purchaseNumber,
        total_amount: items.reduce(
          (sum, item) => sum + item.quantity_ordered * item.unit_cost,
          0,
        ),
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      return {
        success: false,
        error: `Failed to create purchase: ${purchaseError?.message}`,
      };
    }

    // Insert purchase items
    const itemsWithPurchaseId = items.map((item) => ({
      ...item,
      purchase_id: purchase.id,
      total_cost: item.quantity_ordered * item.unit_cost,
    }));

    const { error: itemsError } = await supabase
      .from("purchase_items")
      .insert(itemsWithPurchaseId);

    if (itemsError) {
      return {
        success: false,
        error: `Failed to add purchase items: ${itemsError.message}`,
      };
    }

    return {
      success: true,
      data: purchase,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error creating purchase: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Receive stock from a purchase order
 * Creates stock batches and records cash expense
 */
export async function receiveStock(
  purchaseId: number,
  items: Array<{
    purchase_item_id: number;
    product_id: number;
    quantity_received: number;
    batch_number: string;
    unit_cost: number;
    received_date: string;
    expiry_date?: string;
  }>,
): Promise<ApiResponse<{ stockBatches: StockBatch[] }>> {
  try {
    const createdBatches: StockBatch[] = [];

    // Create stock batches for each item
    for (const item of items) {
      const { data: batch, error: batchError } = await supabase
        .from("stock_batches")
        .insert({
          product_id: item.product_id,
          batch_number: item.batch_number,
          purchase_item_id: item.purchase_item_id,
          quantity_received: item.quantity_received,
          quantity_available: item.quantity_received,
          unit_cost: item.unit_cost,
          received_date: item.received_date,
          expiry_date: item.expiry_date,
        })
        .select()
        .single();

      if (batchError || !batch) {
        return {
          success: false,
          error: `Failed to create stock batch: ${batchError?.message}`,
        };
      }

      createdBatches.push(batch);

      // Record stock movement (in)
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: item.product_id,
          batch_id: batch.id,
          movement_type: "in",
          quantity: item.quantity_received,
          reference_type: "purchase",
          reference_id: purchaseId,
          notes: `Stock received from purchase - Batch: ${item.batch_number}`,
          created_at: new Date().toISOString(),
        });

      if (movementError) {
        return {
          success: false,
          error: `Failed to record stock movement: ${movementError.message}`,
        };
      }

      // Update purchase item with received quantity
      const { error: updateError } = await supabase
        .from("purchase_items")
        .update({ quantity_received: item.quantity_received })
        .eq("id", item.purchase_item_id);

      if (updateError) {
        return {
          success: false,
          error: `Failed to update purchase item: ${updateError.message}`,
        };
      }
    }

    // Check if purchase is fully received
    const { data: purchaseItems } = await supabase
      .from("purchase_items")
      .select("quantity_ordered, quantity_received")
      .eq("purchase_id", purchaseId);

    const allReceived =
      purchaseItems?.every(
        (pi: { quantity_ordered: number; quantity_received: number }) =>
          pi.quantity_ordered === pi.quantity_received,
      ) || false;
    const partialReceived =
      purchaseItems?.some(
        (pi: { quantity_received: number }) => pi.quantity_received > 0,
      ) || false;

    // Update purchase status
    const newStatus = allReceived
      ? "received"
      : partialReceived
        ? "partial"
        : "pending";
    const { error: statusError } = await supabase
      .from("purchases")
      .update({ status: newStatus })
      .eq("id", purchaseId);

    if (statusError) {
      console.error("Failed to update purchase status:", statusError.message);
    }

    return {
      success: true,
      data: { stockBatches: createdBatches },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error receiving stock: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Process payment for a purchase (record cash outflow)
 */
export async function processPurchasePayment(
  purchaseId: number,
  paymentAmount: number,
  paymentMethod: string = "bank_transfer",
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    // Get purchase details
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .select("*, suppliers(*)")
      .eq("id", purchaseId)
      .single();

    if (purchaseError || !purchase) {
      return {
        success: false,
        error: `Purchase not found: ${purchaseError?.message}`,
      };
    }

    // Get current balance
    const currentBalance = await calculateCashBalance();

    if (currentBalance < paymentAmount) {
      return {
        success: false,
        error: `Insufficient cash balance. Current: ${currentBalance}, Required: ${paymentAmount}`,
      };
    }

    // Record cash transaction
    const newBalance = currentBalance - paymentAmount;

    const { error: cashError } = await supabase.from("cash_ledger").insert({
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_type: "payment_made",
      description: `Payment to ${purchase.suppliers?.name || "Supplier"} for Purchase #${purchase.purchase_number} (${paymentMethod})`,
      debit: 0,
      credit: paymentAmount, // Cash outflow
      reference_type: "purchase",
      reference_id: purchaseId,
      balance: newBalance,
      created_at: new Date().toISOString(),
    });

    if (cashError) {
      return {
        success: false,
        error: `Failed to record payment: ${cashError.message}`,
      };
    }

    return {
      success: true,
      data: {
        success: true,
        message: `Payment of ${paymentAmount} recorded for Purchase #${purchase.purchase_number}. New balance: ${newBalance}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error processing payment: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get purchase summary
 */
export async function getPurchaseSummary(startDate: string, endDate: string) {
  try {
    const { data: purchases, error } = await supabase
      .from("purchase_summary")
      .select("*")
      .gte("purchase_date", startDate)
      .lte("purchase_date", endDate)
      .order("purchase_date", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const totalPurchased = purchases.reduce(
      (sum: number, p: any) => sum + p.total_amount,
      0,
    );

    return {
      success: true,
      data: {
        period: `${startDate} to ${endDate}`,
        total_purchased: totalPurchased,
        purchase_count: purchases.length,
        average_order_value:
          purchases.length > 0 ? totalPurchased / purchases.length : 0,
        purchases,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error fetching purchase summary: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Generate unique purchase number
 */
async function generatePurchaseNumber(): Promise<string> {
  const today = new Date();
  const datePrefix = `PO${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  const { data: lastPurchase } = await supabase
    .from("purchases")
    .select("purchase_number")
    .ilike("purchase_number", `${datePrefix}%`)
    .order("purchase_number", { ascending: false })
    .limit(1)
    .single();

  if (!lastPurchase) {
    return `${datePrefix}001`;
  }

  const lastNumber = parseInt(lastPurchase.purchase_number.slice(-3)) || 0;
  return `${datePrefix}${String(lastNumber + 1).padStart(3, "0")}`;
}

/**
 * Calculate current cash balance
 */
async function calculateCashBalance(): Promise<number> {
  const { data, error } = await supabase
    .from("cash_ledger")
    .select("balance")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.balance || 0;
}

export default {
  createPurchase,
  receiveStock,
  processPurchasePayment,
  getPurchaseSummary,
};
