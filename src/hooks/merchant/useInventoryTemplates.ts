import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { loogin } from '../../lib/loogin';
import type { InventoryTemplateItem } from '../../types/inventory';
import { fetchInventoryTemplates } from '../../services/merchant/inventoryService';

const log = loogin.scope('useInventoryTemplates');

export function useInventoryTemplates(search: string) {
  const params = useMemo(() => ({ search, limit: 100 }), [search]);

  return useQuery(['inventory', 'templates', params], async (): Promise<InventoryTemplateItem[]> => {
    const { data, error } = await fetchInventoryTemplates(params);
    if (error) {
      log.error('Failed to load templates', error);
      throw error;
    }
    return data?.items ?? [];
  }, {
    keepPreviousData: true,
  });
}


