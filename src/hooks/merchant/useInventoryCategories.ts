import { useMutation, useQuery, useQueryClient } from 'react-query';
import { loogin } from '../../lib/loogin';
import type { InventoryCategory } from '../../types/inventory';
import {
  createInventoryCategory,
  fetchInventoryCategories,
  updateInventoryCategory,
  deleteInventoryCategory,
} from '../../services/merchant/inventoryService';

const log = loogin.scope('useInventoryCategories');

export function useInventoryCategories(shopId: string) {
  return useQuery(['inventory', shopId, 'categories'], async (): Promise<InventoryCategory[]> => {
    const { data, error } = await fetchInventoryCategories(shopId);
    if (error) {
      log.error('Failed to load categories', error);
      throw error;
    }
    return data ?? [];
  });
}

export function useCreateInventoryCategory(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    async (payload: { name: string; description?: string | null; templateId?: string | null }) => {
      const { data, error } = await createInventoryCategory({ shopId, ...payload });
      if (error) {
        log.error('Failed to create category', error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['inventory', shopId, 'categories']);
      },
    }
  );
}

export function useUpdateInventoryCategory(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    async ({ categoryId, updates }: { categoryId: string; updates: Partial<InventoryCategory> }) => {
      const { data, error } = await updateInventoryCategory(categoryId, updates);
      if (error) {
        log.error('Failed to update category', error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['inventory', shopId, 'categories']);
        queryClient.invalidateQueries(['inventory', shopId, 'items']);
      },
    }
  );
}

export function useDeleteInventoryCategory(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    async (categoryId: string) => {
      const { data, error } = await deleteInventoryCategory(categoryId);
      if (error) {
        log.error('Failed to delete category', error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['inventory', shopId, 'categories']);
        queryClient.invalidateQueries(['inventory', shopId, 'items']);
      },
    }
  );
}


