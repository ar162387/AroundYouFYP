/**
 * Consumer Order Hooks
 * 
 * React hooks for managing orders from the consumer perspective,
 * including placing orders, tracking status, and real-time updates.
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useEffect, useState } from 'react';
import {
  getUserOrders,
  getOrderById,
  getActiveOrder,
  placeOrder,
  cancelOrder as cancelOrderService,
  calculateOrderTotals,
  subscribeToOrder,
  subscribeToUserOrders,
} from '../../services/consumer/orderService';
import {
  OrderWithAll,
  PlaceOrderRequest,
  PlaceOrderResponse,
  OrderCalculation,
  OrderTimerState,
  getOrderStage,
} from '../../types/orders';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: () => [...orderKeys.lists()] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  active: () => [...orderKeys.all, 'active'] as const,
  calculation: (shopId: string, addressId: string, items: any[]) =>
    [...orderKeys.all, 'calculation', shopId, addressId, items] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all orders for the current user
 */
export function useUserOrders() {
  const query = useQuery<OrderWithAll[]>(orderKeys.list(), getUserOrders, {
    staleTime: 30000, // 30 seconds
  });

  return query;
}

/**
 * Get a specific order by ID with real-time updates
 */
export function useOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();
  
  const query = useQuery<OrderWithAll | null>(
    orderKeys.detail(orderId!),
    () => getOrderById(orderId!),
    {
      enabled: !!orderId,
      staleTime: 0, // Always fetch fresh data
    }
  );

  // Subscribe to real-time updates
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = subscribeToOrder(orderId, (updatedOrder) => {
      (queryClient as any).setQueryData(orderKeys.detail(orderId), (old: any) => {
        if (!old) return updatedOrder;
        return { ...old, ...updatedOrder };
      });
    });

    return unsubscribe;
  }, [orderId, queryClient]);

  return query;
}

/**
 * Get the active order (non-terminal status) with real-time updates
 */
export function useActiveOrder() {
  const queryClient = useQueryClient();
  
  const query = useQuery<OrderWithAll | null>(orderKeys.active(), getActiveOrder, {
    staleTime: 0,
    refetchInterval: 5000, // Refetch every 5 seconds as backup
  } as any);

  // Subscribe to real-time updates for all user orders
  useEffect(() => {
    const unsubscribe = subscribeToUserOrders(() => {
      // Refetch active order when any order changes
      queryClient.invalidateQueries(orderKeys.active());
      queryClient.invalidateQueries(orderKeys.list());
    });

    return unsubscribe;
  }, [queryClient]);

  return query;
}

/**
 * Calculate order totals
 */
export function useOrderCalculation(
  shopId: string | undefined,
  addressId: string | undefined,
  items: Array<{ merchant_item_id: string; quantity: number }>
) {
  return useQuery<OrderCalculation>(
    orderKeys.calculation(shopId!, addressId!, items),
    () => calculateOrderTotals(shopId!, items, addressId!),
    {
      enabled: !!shopId && !!addressId && items.length > 0,
      staleTime: 60000, // 1 minute
    }
  );
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Place a new order
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation(
    (request: PlaceOrderRequest) => placeOrder(request),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(orderKeys.list());
        queryClient.invalidateQueries(orderKeys.active());
      },
    }
  );
}

/**
 * Cancel an order
 */
type CancelOrderPayload = { orderId: string; reason?: string };
type CancelOrderResult = { success: boolean; message?: string };

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ orderId, reason }: CancelOrderPayload) => cancelOrderService(orderId, reason),
    {
      onSuccess: (_result, variables) => {
        const payload = variables as CancelOrderPayload | undefined;
        queryClient.invalidateQueries(orderKeys.list());
        if (payload?.orderId) {
          queryClient.invalidateQueries(orderKeys.detail(payload.orderId));
        }
        queryClient.invalidateQueries(orderKeys.active());
      },
    }
  );
}

// ============================================================================
// ORDER TIMER HOOK
// ============================================================================

/**
 * Hook to manage order timer based on current status
 */
export function useOrderTimer(order: OrderWithAll | null | undefined): OrderTimerState {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!order || !order.status) {
      setElapsedSeconds(0);
      return;
    }

    // Terminal states don't need timers
    if (order.status === 'delivered' || order.status === 'cancelled') {
      setElapsedSeconds(0);
      return;
    }

    // Calculate elapsed time based on current status
    const calculateElapsed = () => {
      const now = new Date().getTime();
      let startTime: number;

      switch (order.status) {
        case 'pending':
          startTime = new Date(order.placed_at).getTime();
          break;
        case 'confirmed':
          startTime = new Date(order.confirmed_at!).getTime();
          break;
        case 'out_for_delivery':
          startTime = new Date(order.out_for_delivery_at!).getTime();
          break;
        default:
          return 0;
      }

      return Math.floor((now - startTime) / 1000);
    };

    // Initial calculation
    setElapsedSeconds(calculateElapsed());

    // Update every second
    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [order?.status, order?.placed_at, order?.confirmed_at, order?.out_for_delivery_at]);

  const stage = order ? getOrderStage(order.status) : 'complete';
  const isActive = order ? order.status !== 'delivered' && order.status !== 'cancelled' : false;

  return {
    elapsedSeconds,
    stage: stage === 'complete' ? 'delivery' : stage,
    isActive,
  };
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Get orders count by status
 */
export function useOrdersCountByStatus() {
  const { data: orders } = useUserOrders();

  const counts: Record<'pending' | 'confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled', number> = {
    pending: 0,
    confirmed: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  };

  orders?.forEach((orderItem) => {
    const status = orderItem.status as keyof typeof counts;
    if (status in counts) {
      counts[status] += 1;
    }
  });

  return counts;
}

/**
 * Check if user has any active orders
 */
export function useHasActiveOrder() {
  const { data: activeOrder, isLoading } = useActiveOrder();
  
  return {
    hasActiveOrder: !!activeOrder,
    activeOrder,
    isLoading,
  };
}

