/**
 * Stock Validation Service
 * 
 * Validates item availability and stock before adding items to cart.
 * Checks if items are active and in stock.
 */

import { supabase, executeWithRetry } from '../supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export interface StockValidationResult {
  itemId: string;
  itemName: string;
  isValid: boolean;
  isActive: boolean;
  reason?: string; // Error reason if invalid
}

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Validate if a single item is available for purchase
 */
export async function validateItemStock(
  itemId: string
): Promise<ServiceResult<StockValidationResult>> {
  try {
    const { data, error } = await executeWithRetry(async (client) => {
      return await client
        .from('merchant_items')
        .select('id, name, is_active')
        .eq('id', itemId)
        .single();
    });

    if (error) {
      console.error('[StockValidationService] Error validating item:', error);
      
      // Item not found
      if (error.code === 'PGRST116') {
        return {
          data: {
            itemId,
            itemName: 'Unknown',
            isValid: false,
            isActive: false,
            reason: 'Item not found',
          },
          error: null,
        };
      }
      
      return { data: null, error };
    }

    if (!data) {
      return {
        data: {
          itemId,
          itemName: 'Unknown',
          isValid: false,
          isActive: false,
          reason: 'Item not found',
        },
        error: null,
      };
    }

    const isActive = data.is_active === true;
    const isValid = isActive;

    return {
      data: {
        itemId: data.id,
        itemName: data.name || 'Unknown',
        isValid,
        isActive,
        reason: isValid ? undefined : 'Item is not active',
      },
      error: null,
    };
  } catch (error: any) {
    console.error('[StockValidationService] Exception validating item:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Validate multiple items at once
 */
export async function validateItemsStock(
  itemIds: string[]
): Promise<ServiceResult<StockValidationResult[]>> {
  try {
    if (itemIds.length === 0) {
      return { data: [], error: null };
    }

    const { data, error } = await executeWithRetry(async (client) => {
      return await client
        .from('merchant_items')
        .select('id, name, is_active')
        .in('id', itemIds);
    });

    if (error) {
      console.error('[StockValidationService] Error validating items:', error);
      return { data: null, error };
    }

    const items = data || [];
    const itemsMap = new Map(
      items.map((item: any) => [
        item.id,
        {
          itemId: item.id,
          itemName: item.name || 'Unknown',
          isValid: item.is_active === true,
          isActive: item.is_active === true,
          reason: item.is_active === true ? undefined : 'Item is not active',
        } as StockValidationResult,
      ])
    );

    // Include items that were not found
    const results: StockValidationResult[] = itemIds.map((itemId) => {
      const validation = itemsMap.get(itemId);
      if (validation) {
        return validation;
      }

      return {
        itemId,
        itemName: 'Unknown',
        isValid: false,
        isActive: false,
        reason: 'Item not found',
      };
    });

    return { data: results, error: null };
  } catch (error: any) {
    console.error('[StockValidationService] Exception validating items:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Check if all items in a list are valid
 */
export async function areAllItemsValid(
  itemIds: string[]
): Promise<{ valid: boolean; invalidItems: StockValidationResult[] }> {
  const validationResult = await validateItemsStock(itemIds);

  if (validationResult.error || !validationResult.data) {
    return {
      valid: false,
      invalidItems: itemIds.map((id) => ({
        itemId: id,
        itemName: 'Unknown',
        isValid: false,
        isActive: false,
        reason: validationResult.error?.message || 'Validation failed',
      })),
    };
  }

  const invalidItems = validationResult.data.filter((item) => !item.isValid);

  return {
    valid: invalidItems.length === 0,
    invalidItems,
  };
}

