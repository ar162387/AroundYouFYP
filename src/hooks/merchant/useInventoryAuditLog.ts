import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { loogin } from '../../lib/loogin';
import type { InventoryAuditLogEntry, InventoryAuditLogFilters } from '../../types/inventory';
import { fetchInventoryAuditLog } from '../../services/merchant/inventoryService';

const log = loogin.scope('useInventoryAuditLog');

export function useInventoryAuditLog(shopId: string, filters: InventoryAuditLogFilters) {
  // Stabilize query key by extracting primitive values to prevent infinite re-renders
  const key = useMemo(
    () => [
      'inventory',
      shopId,
      'audit-log',
      filters.limit,
      filters.cursor,
      filters.merchantItemId,
      filters.field,
      filters.dateFrom,
      filters.dateTo,
      filters.source,
      filters.actionTypes?.join(','),
      filters.actorIds?.join(','),
    ],
    [
      shopId,
      filters.limit,
      filters.cursor,
      filters.merchantItemId,
      filters.field,
      filters.dateFrom,
      filters.dateTo,
      filters.source,
      filters.actionTypes,
      filters.actorIds,
    ]
  );

  return useQuery(key, async (): Promise<{ entries: InventoryAuditLogEntry[]; nextCursor?: string | null }> => {
    const { data, error } = await fetchInventoryAuditLog(shopId, filters);
    if (error) {
      log.error('Failed to fetch audit log', error);
      throw error;
    }
    return data ?? { entries: [], nextCursor: null };
  });
}


