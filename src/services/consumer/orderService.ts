import {
  Order,
  OrderCalculation,
  OrderItem,
  OrderWithAll,
  OrderWithItems,
  PlaceOrderRequest,
  PlaceOrderResponse,
} from '../../types/orders';
import { apiClient, toApiError } from '../apiClient';
import { subscribeToOrderGroup } from '../orderRealtime';

/** API returns line items as `items`; apiClient snake_case pass-through leaves that key as `items`, not `order_items`. */
type ConsumerOrderPayload = OrderWithAll & { items?: OrderItem[] };

function mergedOrderLineItems(order: ConsumerOrderPayload): OrderItem[] {
  if (Array.isArray(order.order_items) && order.order_items.length > 0) {
    return order.order_items;
  }
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items;
  }
  return order.order_items ?? [];
}

function normalizeConsumerOrder(order: ConsumerOrderPayload): OrderWithAll {
  const { items: _items, ...rest } = order;
  return {
    ...(rest as OrderWithAll),
    order_items: mergedOrderLineItems(order),
  };
}

export async function calculateOrderTotals(
  shopId: string,
  items: Array<{ merchant_item_id: string; quantity: number }>,
  addressId: string
): Promise<OrderCalculation> {
  return apiClient.post<OrderCalculation>('/api/v1/consumer/orders/calculate', {
    shop_id: shopId,
    consumer_address_id: addressId,
    items,
  });
}

export async function placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponse> {
  try {
    const order = await apiClient.post<OrderWithItems>('/api/v1/consumer/orders', request);
    return { success: true, order };
  } catch (error) {
    return {
      success: false,
      message: toApiError(error).message,
      order: null as unknown as OrderWithItems,
    };
  }
}

export async function getUserOrders(): Promise<OrderWithAll[]> {
  try {
    const list = await apiClient.get<ConsumerOrderPayload[]>('/api/v1/consumer/orders');
    return list.map(normalizeConsumerOrder);
  } catch {
    return [];
  }
}

export async function getOrderById(orderId: string): Promise<OrderWithAll | null> {
  try {
    const order = await apiClient.get<ConsumerOrderPayload>(`/api/v1/consumer/orders/${orderId}`);
    return normalizeConsumerOrder(order);
  } catch {
    return null;
  }
}

export async function getActiveOrder(): Promise<OrderWithAll | null> {
  try {
    const order = await apiClient.get<ConsumerOrderPayload>('/api/v1/consumer/orders/active');
    return normalizeConsumerOrder(order);
  } catch {
    return null;
  }
}

export function subscribeToOrder(orderId: string, callback: (order: Order) => void) {
  let cleanup: (() => Promise<void>) | null = null;
  let disposed = false;

  (async () => {
    try {
      cleanup = await subscribeToOrderGroup(orderId, (payload) => {
        callback(payload as Order);
      });
    } catch (error) {
      console.warn('Failed to subscribe to order updates', error);
    }
  })();

  return () => {
    disposed = true;
    if (disposed && cleanup) {
      cleanup().catch(() => undefined);
    }
  };
}

export function subscribeToUserOrders(callback: (orders: Order[]) => void) {
  let currentOrderCleanup: (() => Promise<void>) | null = null;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;

  const refresh = async () => {
    const orders = await getUserOrders();
    callback(orders);

    const activeOrder = await getActiveOrder();
    if (activeOrder && !currentOrderCleanup) {
      currentOrderCleanup = await subscribeToOrderGroup(activeOrder.id, async () => {
        callback(await getUserOrders());
      });
    }
    if (!activeOrder && currentOrderCleanup) {
      await currentOrderCleanup();
      currentOrderCleanup = null;
    }
  };

  refresh().catch(() => undefined);
  pollingTimer = setInterval(() => {
    refresh().catch(() => undefined);
  }, 15000);

  return () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }
    if (currentOrderCleanup) {
      currentOrderCleanup().catch(() => undefined);
    }
  };
}

export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await apiClient.post(`/api/v1/consumer/orders/${orderId}/cancel`, {
      reason: reason || 'Cancelled by customer',
    });
    return { success: true };
  } catch (error) {
    return { success: false, message: toApiError(error).message };
  }
}

