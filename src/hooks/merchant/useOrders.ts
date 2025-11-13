/**
 * Merchant Order Hooks
 * 
 * React hooks for managing orders from the merchant perspective,
 * including order status updates, runner assignment, and analytics.
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useEffect } from 'react';
import {
  getShopOrders,
  getFilteredShopOrders,
  confirmOrder,
  assignRunnerAndDispatch,
  markOrderDelivered,
  cancelOrder as cancelOrderService,
  getDeliveryRunnersWithStatus,
  getShopOrderAnalytics,
  getShopOrderTimeSeries,
  subscribeToShopOrders,
} from '../../services/merchant/orderService';
import {
  OrderWithAll,
  OrderFilters,
  DeliveryRunnerWithStatus,
  OrderAnalytics,
} from '../../types/orders';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const merchantOrderKeys = {
  all: ['merchant-orders'] as const,
  lists: () => [...merchantOrderKeys.all, 'list'] as const,
  list: (shopId: string) => [...merchantOrderKeys.lists(), shopId] as const,
  filtered: (shopId: string, filters: OrderFilters) =>
    [...merchantOrderKeys.lists(), shopId, 'filtered', filters] as const,
  runners: (shopId: string) =>
    [...merchantOrderKeys.all, 'runners', shopId] as const,
  analytics: (shopId: string, timeFilter?: string) =>
    [...merchantOrderKeys.all, 'analytics', shopId, timeFilter] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all orders for a shop with real-time updates
 */
export function useShopOrders(shopId: string | undefined) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: merchantOrderKeys.list(shopId!),
    queryFn: () => getShopOrders(shopId!),
    enabled: !!shopId,
    staleTime: 0, // Always fetch fresh data
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!shopId) return;

    const unsubscribe = subscribeToShopOrders(shopId, (orders) => {
      queryClient.setQueryData(merchantOrderKeys.list(shopId), orders);
    });

    return unsubscribe;
  }, [shopId, queryClient]);

  return query;
}

/**
 * Get filtered orders for a shop
 */
export function useFilteredShopOrders(
  shopId: string | undefined,
  filters: OrderFilters
) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: merchantOrderKeys.filtered(shopId!, filters),
    queryFn: () => getFilteredShopOrders(shopId!, filters),
    enabled: !!shopId,
    staleTime: 0,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!shopId) return;

    const unsubscribe = subscribeToShopOrders(shopId, () => {
      // Invalidate filtered queries on any order change
      queryClient.invalidateQueries({
        queryKey: merchantOrderKeys.filtered(shopId, filters),
      });
    });

    return unsubscribe;
  }, [shopId, filters, queryClient]);

  return query;
}

/**
 * Get delivery runners with their status
 */
export function useDeliveryRunners(shopId: string | undefined) {
  return useQuery<DeliveryRunnerWithStatus[]>({
    queryKey: merchantOrderKeys.runners(shopId!),
    queryFn: () => getDeliveryRunnersWithStatus(shopId!),
    enabled: !!shopId,
    staleTime: 5000, // 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Get order analytics for a shop
 */
export function useShopOrderAnalytics(
  shopId: string | undefined,
  timeFilter?: OrderFilters['timeFilter'],
  customStartDate?: Date,
  customEndDate?: Date
) {
  return useQuery<OrderAnalytics | null>({
    queryKey: [...merchantOrderKeys.analytics(shopId!, timeFilter), customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: () => getShopOrderAnalytics(shopId!, timeFilter, customStartDate, customEndDate),
    enabled: !!shopId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get time-series order and revenue data for charting
 */
export function useShopOrderTimeSeries(
  shopId: string | undefined,
  timeFilter: 'today' | 'yesterday' | '7days' | '30days' | 'all_time' | 'custom',
  customStartDate?: Date,
  customEndDate?: Date
) {
  return useQuery({
    queryKey: [...merchantOrderKeys.all, 'time-series', shopId, timeFilter, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: () => getShopOrderTimeSeries(shopId!, timeFilter, customStartDate, customEndDate),
    enabled: !!shopId,
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Confirm an order
 * Note: Real-time subscription will update cache automatically
 */
export function useConfirmOrder() {
  return useMutation({
    mutationFn: (orderId: string) => confirmOrder(orderId),
    // No onSuccess invalidation - real-time subscription handles cache updates
  });
}

/**
 * Assign runner and dispatch order
 * Note: Real-time subscription will update cache automatically
 */
export function useAssignRunnerAndDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      runnerId,
      shopId,
    }: {
      orderId: string;
      runnerId: string;
      shopId?: string;
    }) => assignRunnerAndDispatch(orderId, runnerId),
    onSuccess: (_, variables) => {
      // Only invalidate runner status (not orders - real-time handles that)
      if (variables.shopId) {
        queryClient.invalidateQueries({ queryKey: merchantOrderKeys.runners(variables.shopId) });
      }
    },
  });
}

/**
 * Mark order as delivered
 * Note: Real-time subscription will update cache automatically
 */
export function useMarkOrderDelivered() {
  return useMutation({
    mutationFn: (orderId: string) => markOrderDelivered(orderId),
    // No onSuccess invalidation - real-time subscription handles cache updates
  });
}

/**
 * Cancel an order (merchant side)
 * Note: Real-time subscription will update cache automatically
 */
export function useCancelOrder() {
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      cancelOrderService(orderId, reason),
    // No onSuccess invalidation - real-time subscription handles cache updates
  });
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Group orders by time periods
 */
export function useGroupedOrders(orders: OrderWithAll[] | undefined) {
  if (!orders) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const grouped = {
    today: [] as OrderWithAll[],
    yesterday: [] as OrderWithAll[],
    last7Days: [] as OrderWithAll[],
    last30Days: [] as OrderWithAll[],
    older: [] as OrderWithAll[],
  };

  orders.forEach((order) => {
    const orderDate = new Date(order.placed_at);
    
    if (orderDate >= todayStart) {
      grouped.today.push(order);
    } else if (orderDate >= yesterdayStart) {
      grouped.yesterday.push(order);
    } else if (orderDate >= sevenDaysAgo) {
      grouped.last7Days.push(order);
    } else if (orderDate >= thirtyDaysAgo) {
      grouped.last30Days.push(order);
    } else {
      grouped.older.push(order);
    }
  });

  // Sort today's orders by status priority (active statuses first)
  const statusPriority = {
    pending: 1,
    confirmed: 2,
    out_for_delivery: 3,
    delivered: 4,
    cancelled: 5,
  };

  grouped.today.sort((a, b) => {
    const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    // If same priority, sort by time (newest first)
    return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
  });

  return grouped;
}

/**
 * Get active orders count (pending, confirmed, out_for_delivery)
 */
export function useActiveOrdersCount(shopId: string | undefined) {
  const { data: orders } = useShopOrders(shopId);

  const activeCount = orders?.filter(
    (order) =>
      order.status === 'pending' ||
      order.status === 'confirmed' ||
      order.status === 'out_for_delivery'
  ).length || 0;

  return activeCount;
}

/**
 * Get pending orders that need confirmation
 */
export function usePendingOrdersCount(shopId: string | undefined) {
  const { data: orders } = useShopOrders(shopId);

  const pendingCount = orders?.filter(
    (order) => order.status === 'pending'
  ).length || 0;

  return pendingCount;
}

