import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { loogin } from '../../lib/loogin';
import type { InventoryItem, InventoryListParams, InventoryListResponse } from '../../types/inventory';
import {
  createInventoryItem,
  fetchInventoryItems,
  toggleInventoryItemActive,
  updateInventoryItem,
  deleteInventoryItem,
} from '../../services/merchant/inventoryService';

const log = loogin.scope('useInventoryItems');

export function useInventoryItems(shopId: string, params: InventoryListParams) {
  const categoriesKey = useMemo(() => (params.categoryIds ? [...params.categoryIds].sort().join(',') : ''), [
    params.categoryIds,
  ]);

  const key = useMemo(
    () => [
      'inventory',
      shopId,
      'items',
      params.search ?? '',
      params.active ?? 'all',
      params.templateFilter ?? 'all',
      categoriesKey,
      params.cursor ?? '',
      params.limit ?? 50,
    ],
    [shopId, params.search, params.active, params.templateFilter, categoriesKey, params.cursor, params.limit]
  );

  return useQuery(key, async (): Promise<InventoryListResponse> => {
    const { data, error } = await fetchInventoryItems(shopId, params);
    if (error) {
      log.error('Failed to load items', error);
      throw error;
    }
    return data ?? { items: [], nextCursor: null };
  }, {
    keepPreviousData: true,
  });
}

export function useCreateInventoryItem(shopId: string, params: InventoryListParams) {
  const queryClient = useQueryClient();

  return useMutation(
    async (payload: Parameters<typeof createInventoryItem>[0]) => {
      const { data, error } = await createInventoryItem(payload);
      if (error) {
        log.error('Failed to create item', error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['inventory', shopId, 'items'] });
      },
    }
  );
}

export function useUpdateInventoryItem(shopId: string, params: InventoryListParams) {
  const queryClient = useQueryClient();

  return useMutation(
    async ({ itemId, updates }: { itemId: string; updates: Parameters<typeof updateInventoryItem>[1] }) => {
      const { data, error } = await updateInventoryItem(itemId, updates);
      if (error) {
        log.error('Failed to update item', error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['inventory', shopId, 'items'] });
      },
    }
  );
}

export function useToggleInventoryItem(shopId: string, params: InventoryListParams) {
  const queryClient = useQueryClient();

  return useMutation(
    async ({ itemId, isActive }: { itemId: string; isActive: boolean }) => {
      const { data, error } = await toggleInventoryItemActive(itemId, isActive);
      if (error) {
        log.error('Failed to toggle item', error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['inventory', shopId, 'items'] });
      },
    }
  );
}

export function formatPrice(priceCents: number, currency = 'PKR'): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
}

export type InventoryItemList = InventoryItem[];

export function useDeleteInventoryItem(shopId: string, params: InventoryListParams) {
  const queryClient = useQueryClient();

  return useMutation(
    async (itemId: string) => {
      const { data, error } = await deleteInventoryItem(itemId);
      if (error) {
        log.error('Failed to delete item', error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['inventory', shopId, 'items'] });
      },
    }
  );
}


