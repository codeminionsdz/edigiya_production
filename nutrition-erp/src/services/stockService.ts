/**
 * Stock Service
 * Manages stock levels, FIFO batching, and inventory adjustments
 */

import { createClient } from '@supabase/supabase-js';
import { StockLevel, StockBatch, ApiResponse, CreateStockMovementInput } from '../types';
import mockSupabase from '../lib/mockDatabase';

// Use mock database if credentials are placeholders (development mode)
const isDevMode = 
  process.env.VITE_SUPABASE_URL?.includes('your-project') ||
  process.env.VITE_SUPABASE_ANON_KEY?.includes('your-anon-key');

const supabase = isDevMode 
  ? (mockSupabase as any)
  : createClient(
      process.env.VITE_SUPABASE_URL || '',
      process.env.VITE_SUPABASE_ANON_KEY || ''
    );

/**
 * Get current stock level for a product
 */
export async function getStockLevel(productId: number): Promise<ApiResponse<StockLevel>> {
  try {
    const { data: stockLevel, error } = await supabase
      .from('stock_levels')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: stockLevel || {
        product_id: productId,
        total_quantity: 0,
        batch_count: 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting stock level: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get all available batches for a product (FIFO order)
 */
export async function getProductBatches(productId: number): Promise<ApiResponse<StockBatch[]>> {
  try {
    const { data: batches, error } = await supabase
      .from('stock_batches')
      .select('*')
      .eq('product_id', productId)
      .gt('quantity_available', 0)
      .order('received_date', { ascending: true }); // FIFO: oldest first

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: batches || [],
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting batches: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Record stock adjustment (damage, loss, etc.)
 */
export async function recordStockAdjustment(
  productId: number,
  quantity: number,
  reason: string,
  notes?: string
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    // Get batches for this product to deduct from FIFO
    const { data: batches, error: batchError } = await supabase
      .from('stock_batches')
      .select('*')
      .eq('product_id', productId)
      .gt('quantity_available', 0)
      .order('received_date', { ascending: true });

    if (batchError || !batches || batches.length === 0) {
      return {
        success: false,
        error: `No stock available for product ${productId}`,
      };
    }

    let remainingQuantity = quantity;
    const adjustedBatches: Array<{ batch_id: number; quantity: number }> = [];

    // Deduct from batches in FIFO order
    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      const quantityToAdjust = Math.min(batch.quantity_available, remainingQuantity);

      const { error: updateError } = await supabase
        .from('stock_batches')
        .update({ quantity_available: batch.quantity_available - quantityToAdjust })
        .eq('id', batch.id);

      if (updateError) {
        return {
          success: false,
          error: `Failed to adjust batch: ${updateError.message}`,
        };
      }

      adjustedBatches.push({
        batch_id: batch.id,
        quantity: quantityToAdjust,
      });

      remainingQuantity -= quantityToAdjust;
    }

    if (remainingQuantity > 0) {
      return {
        success: false,
        error: `Only ${quantity - remainingQuantity} of ${quantity} units could be adjusted (insufficient stock)`,
      };
    }

    // Record stock movements
    for (const adj of adjustedBatches) {
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: productId,
          batch_id: adj.batch_id,
          movement_type: 'adjustment',
          quantity: adj.quantity,
          reference_type: 'adjustment',
          notes: `${reason}${notes ? ' - ' + notes : ''}`,
          created_at: new Date().toISOString(),
        });

      if (movementError) {
        return {
          success: false,
          error: `Failed to record movement: ${movementError.message}`,
        };
      }
    }

    return {
      success: true,
      data: {
        success: true,
        message: `Adjustment recorded: ${quantity} units of product ${productId} (${reason})`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error recording adjustment: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get stock movement history for a product
 */
export async function getStockHistory(
  productId: number,
  startDate?: string,
  endDate?: string,
  limit: number = 100
) {
  try {
    let query = supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const { data: movements, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: {
        product_id: productId,
        movement_count: movements?.length || 0,
        movements,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting stock history: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get all products with low stock
 */
export async function getLowStockProducts(minThreshold: number = 10) {
  try {
    const { data: lowStockProducts, error } = await supabase
      .from('stock_levels')
      .select('product_id, total_quantity')
      .lt('total_quantity', minThreshold);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: {
        threshold: minThreshold,
        count: lowStockProducts?.length || 0,
        products: lowStockProducts || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting low stock: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get stock value summary (total value at cost)
 */
export async function getStockValue() {
  try {
    const { data: batches, error } = await supabase
      .from('stock_batches')
      .select('quantity_available, unit_cost')
      .gt('quantity_available', 0);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    const totalValue = batches?.reduce((sum, b) => sum + b.quantity_available * b.unit_cost, 0) || 0;
    const totalUnits = batches?.reduce((sum, b) => sum + b.quantity_available, 0) || 0;

    return {
      success: true,
      data: {
        total_units: totalUnits,
        total_value: totalValue,
        average_unit_cost: totalUnits > 0 ? totalValue / totalUnits : 0,
        batch_count: batches?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error calculating stock value: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get batches nearing expiry (if expiry_date is set)
 */
export async function getExpiringStock(daysUntilExpiry: number = 30) {
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);

    const { data: expiringBatches, error } = await supabase
      .from('stock_batches')
      .select('*')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', expiryDate.toISOString().split('T')[0])
      .gt('quantity_available', 0)
      .order('expiry_date', { ascending: true });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: {
        days_until_expiry: daysUntilExpiry,
        batch_count: expiringBatches?.length || 0,
        batches: expiringBatches || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error getting expiring stock: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export default {
  getStockLevel,
  getProductBatches,
  recordStockAdjustment,
  getStockHistory,
  getLowStockProducts,
  getStockValue,
  getExpiringStock,
};
