import { useQuery } from 'react-query';
import { loogin } from '../../lib/loogin';
import type { InventoryTemplateCategory } from '../../types/inventory';
import { fetchTemplateCategories } from '../../services/merchant/inventoryService';

const log = loogin.scope('useInventoryTemplateCategories');

export function useInventoryTemplateCategories() {
  return useQuery(['inventory', 'template-categories'], async (): Promise<InventoryTemplateCategory[]> => {
    const { data, error } = await fetchTemplateCategories();
    if (error) {
      log.error('Failed to load template categories', error);
      throw error;
    }
    return data ?? [];
  });
}


