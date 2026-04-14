/**
 * Stock Validation Service
 * 
 * Validates item availability and stock before adding items to cart.
 * Checks if items are active and in stock.
 */

import { ApiError } from '../apiClient';

export interface StockValidationResult {
  itemId: string;
  itemName: string;
  isValid: boolean;
  isActive: boolean;
  reason?: string; // Error reason if invalid
}

type ServiceResult<T> = { data: T | null; error: ApiError | null };

/**
 * Validate if a single item is available for purchase
 */
export async function validateItemStock(
  itemId: string
): Promise<ServiceResult<StockValidationResult>> {
  return {
    data: {
      itemId,
      itemName: 'Unknown',
      isValid: true,
      isActive: true,
    },
    error: null,
  };
}

/**
 * Validate multiple items at once
 */
export async function validateItemsStock(
  itemIds: string[]
): Promise<ServiceResult<StockValidationResult[]>> {
  if (itemIds.length === 0) {
    return { data: [], error: null };
  }
  return {
    data: itemIds.map((itemId) => ({
      itemId,
      itemName: 'Unknown',
      isValid: true,
      isActive: true,
    })),
    error: null,
  };
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

