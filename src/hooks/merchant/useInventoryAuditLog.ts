import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { loogin } from '../../lib/loogin';
import type { InventoryAuditLogEntry, InventoryAuditLogFilters } from '../../types/inventory';
import { fetchInventoryAuditLog } from '../../services/merchant/inventoryService';

const log = loogin.scope('useInventoryAuditLog');

export function useInventoryAuditLog(shopId: string, filters: InventoryAuditLogFilters) {
  const key = useMemo(() => ['inventory', shopId, 'audit-log', filters], [shopId, filters]);

  return useQuery(key, async (): Promise<{ entries: InventoryAuditLogEntry[]; nextCursor?: string | null }> => {
    const { data, error } = await fetchInventoryAuditLog(shopId, filters);
    if (error) {
      log.error('Failed to fetch audit log', error);
      throw error;
    }
    return data ?? { entries: [], nextCursor: null };
  });
}


