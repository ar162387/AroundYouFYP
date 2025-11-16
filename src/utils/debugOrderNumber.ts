/**
 * Debug utility for order number generation issues
 */

import { supabase } from '../services/supabase';

/**
 * Check if the order number generation function has the correct signature
 */
export async function debugOrderNumberGeneration(): Promise<{
  hasShopIdParam: boolean;
  functionSignature: string | null;
  error: string | null;
}> {
  try {
    // Try to call the function with shop_id parameter (new version)
    const testShopId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase.rpc('generate_order_number', {
      shop_id_param: testShopId,
    });

    if (!error) {
      return {
        hasShopIdParam: true,
        functionSignature: `generate_order_number(shop_id_param UUID) -> ${data}`,
        error: null,
      };
    }

    // If that fails, try without parameter (old version)
    if (error.message?.includes('function generate_order_number(uuid) does not exist')) {
      // Check if old version exists
      const { data: oldData, error: oldError } = await supabase.rpc('generate_order_number');

      if (!oldError) {
        return {
          hasShopIdParam: false,
          functionSignature: `generate_order_number() -> ${oldData} (OLD VERSION)`,
          error: 'Migration 029_fix_order_number_race_condition.sql has not been applied!',
        };
      }
    }

    return {
      hasShopIdParam: false,
      functionSignature: null,
      error: error.message || 'Unknown error checking function',
    };
  } catch (err: any) {
    return {
      hasShopIdParam: false,
      functionSignature: null,
      error: err.message || 'Failed to check function',
    };
  }
}

/**
 * Get recent order numbers for debugging
 */
export async function getRecentOrderNumbers(shopId: string, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, shop_id, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err.message || 'Failed to fetch recent orders',
    };
  }
}

