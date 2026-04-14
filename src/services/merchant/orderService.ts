import { apiClient, toApiError } from '../apiClient';
import { subscribeToShopGroup } from '../orderRealtime';
import {
  OrderWithAll,
  DeliveryRunnerWithStatus,
  OrderFilters,
  OrderAnalytics,
} from '../../types/orders';

type MerchantShopSummary = {
  id: string;
  name?: string;
  shop_type?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

function normalizeMerchantOrder(raw: any, shop?: MerchantShopSummary): OrderWithAll {
  const fallbackShop = {
    id: shop?.id || raw?.shop_id || raw?.shopId || '',
    name: shop?.name || raw?.shop?.name || 'Unknown Shop',
    shop_type: shop?.shop_type || raw?.shop?.shop_type || '',
    address: shop?.address || raw?.shop?.address || '',
    latitude: shop?.latitude ?? raw?.shop?.latitude ?? 0,
    longitude: shop?.longitude ?? raw?.shop?.longitude ?? 0,
  };

  return {
    ...raw,
    shop_id: raw?.shop_id || raw?.shopId || fallbackShop.id,
    delivery_address: raw?.delivery_address || raw?.deliveryAddress || {},
    order_items: raw?.order_items || raw?.items || [],
    shop: raw?.shop || fallbackShop,
  } as OrderWithAll;
}

async function resolveShopIdForOrder(orderId: string): Promise<string> {
  const shops = await apiClient.get<Array<{ id: string }>>('/api/v1/merchant/shops');
  for (const shop of shops || []) {
    try {
      await apiClient.get(`/api/v1/merchant/shops/${shop.id}/orders/${orderId}`);
      return shop.id;
    } catch {
      // Continue search.
    }
  }
  throw new Error('Order not found in merchant shops.');
}

// ============================================================================
// GET SHOP ORDERS
// ============================================================================

/**
 * Get all orders for a shop
 */
export async function getShopOrders(shopId: string): Promise<OrderWithAll[]> {
  try {
    const orders = await apiClient.get<any[]>(`/api/v1/merchant/shops/${shopId}/orders`);
    return (orders || []).map((order) => normalizeMerchantOrder(order, { id: shopId }));
  } catch (error) {
    console.error('Error getting shop orders:', error);
    return [];
  }
}

/**
 * Get all orders for all shops owned by a merchant
 */
export async function getAllMerchantOrders(userId: string): Promise<OrderWithAll[]> {
  try {
    const shops = await apiClient.get<MerchantShopSummary[]>('/api/v1/merchant/shops');
    const allOrders = await Promise.all(
      (shops || []).map(async (shop) => {
        const shopOrders = await apiClient.get<any[]>(`/api/v1/merchant/shops/${shop.id}/orders`);
        return (shopOrders || []).map((order) => normalizeMerchantOrder(order, shop));
      })
    );
    return allOrders.flat();
  } catch (error) {
    console.error('Error getting all merchant orders:', error);
    return [];
  }
}

/**
 * Get filtered orders for a shop
 */
export async function getFilteredShopOrders(
  shopId: string,
  filters: OrderFilters
): Promise<OrderWithAll[]> {
  try {
    let orders = await getShopOrders(shopId);
    if (filters.statusFilter) {
      orders = orders.filter((order) => order.status === filters.statusFilter);
    }
    return orders;
  } catch (error) {
    console.error('Error getting filtered shop orders:', error);
    return [];
  }
}

// ============================================================================
// UPDATE ORDER STATUS
// ============================================================================

/**
 * Confirm an order
 * Note: Timestamps are set automatically by database triggers
 */
export async function confirmOrder(
  orderId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const shopId = await resolveShopIdForOrder(orderId);
    await apiClient.post(`/api/v1/merchant/shops/${shopId}/orders/${orderId}/confirm`);
    return { success: true };
  } catch (error) {
    return { success: false, message: toApiError(error).message };
  }
}

/**
 * Assign runner and mark order as out for delivery
 * Note: Timestamps are set automatically by database triggers
 */
export async function assignRunnerAndDispatch(
  orderId: string,
  runnerId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const shopId = await resolveShopIdForOrder(orderId);
    await apiClient.post(`/api/v1/merchant/shops/${shopId}/orders/${orderId}/dispatch`, {
      runner_id: runnerId,
    });
    return { success: true };
  } catch (error) {
    return { success: false, message: toApiError(error).message };
  }
}

/**
 * Mark order as delivered
 * Note: Timestamps are set automatically by database triggers
 */
export async function markOrderDelivered(
  orderId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const shopId = await resolveShopIdForOrder(orderId);
    await apiClient.post(`/api/v1/merchant/shops/${shopId}/orders/${orderId}/deliver`);
    return { success: true };
  } catch (error) {
    return { success: false, message: toApiError(error).message };
  }
}

/**
 * Cancel an order (merchant side)
 */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const shopId = await resolveShopIdForOrder(orderId);
    await apiClient.post(`/api/v1/merchant/shops/${shopId}/orders/${orderId}/cancel`, { reason });
    return { success: true };
  } catch (error) {
    return { success: false, message: toApiError(error).message };
  }
}

// ============================================================================
// DELIVERY RUNNERS
// ============================================================================

/**
 * Get delivery runners with their current status
 */
export async function getDeliveryRunnersWithStatus(
  shopId: string
): Promise<DeliveryRunnerWithStatus[]> {
  try {
    return await apiClient.get<DeliveryRunnerWithStatus[]>(`/api/v1/merchant/shops/${shopId}/runners`);
  } catch (error) {
    console.error('Error getting delivery runners with status:', error);
    return [];
  }
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get order analytics for a shop
 */
export async function getShopOrderAnalytics(
  shopId: string,
  timeFilter?: OrderFilters['timeFilter'],
  customStartDate?: Date,
  customEndDate?: Date
): Promise<OrderAnalytics | null> {
  try {
    const analytics = await apiClient.get<OrderAnalytics>(`/api/v1/merchant/shops/${shopId}/analytics`);
    return analytics;
  } catch (error) {
    console.error('Error getting shop order analytics:', error);
    return null;
  }
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getTimeSeriesRange(
  timeFilter: 'today' | 'yesterday' | '7days' | '30days' | 'all_time' | 'custom',
  customStartDate?: Date,
  customEndDate?: Date
): { start: Date; end: Date } | null {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  switch (timeFilter) {
    case 'today':
      return { start: todayStart, end: tomorrowStart };
    case 'yesterday': {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 1);
      return { start, end: todayStart };
    }
    case '7days': {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 6);
      return { start, end: tomorrowStart };
    }
    case '30days': {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 29);
      return { start, end: tomorrowStart };
    }
    case 'all_time':
      return { start: new Date(0), end: new Date(8640000000000000) };
    case 'custom': {
      if (!customStartDate || !customEndDate) return null;
      const start = startOfLocalDay(customStartDate);
      const endDay = startOfLocalDay(customEndDate);
      const end = new Date(endDay);
      end.setDate(end.getDate() + 1);
      if (start.getTime() >= end.getTime()) return null;
      return { start, end };
    }
    default:
      return { start: todayStart, end: tomorrowStart };
  }
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function inRangeDate(d: Date, start: Date, end: Date): boolean {
  const t = d.getTime();
  return t >= start.getTime() && t < end.getTime();
}

function deliveredRevenueTime(order: OrderWithAll): Date | null {
  if (order.status !== 'delivered') return null;
  const raw = order.delivered_at || order.placed_at;
  return raw ? new Date(raw) : null;
}

function padSeriesForChart(xLabels: string[], dataPkr: number[]): { xLabels: string[]; data: number[] } {
  if (dataPkr.length === 0) return { xLabels: [], data: [] };
  if (dataPkr.length === 1) {
    return { xLabels: ['', xLabels[0] ?? ''], data: [0, dataPkr[0]] };
  }
  return { xLabels, data: dataPkr };
}

function buildTodayYesterdaySeries(
  range: { start: Date; end: Date },
  orders: OrderWithAll[]
): { xLabels: string[]; data: number[]; orders: number; revenue: number } {
  const placedInRange = orders.filter((o) => inRange(o.placed_at, range.start, range.end));
  let revenueCents = 0;
  const bucketPkr = new Array(6).fill(0);
  for (const o of orders) {
    const rt = deliveredRevenueTime(o);
    if (!rt) continue;
    if (!inRangeDate(rt, range.start, range.end)) continue;
    revenueCents += o.total_cents;
    const hour = rt.getHours();
    const bucket = Math.min(5, Math.floor(hour / 4));
    bucketPkr[bucket] += Math.round(o.total_cents / 100);
  }
  const xLabels = ['12a', '4a', '8a', '12p', '4p', '8p'];
  return {
    xLabels,
    data: bucketPkr,
    orders: placedInRange.length,
    revenue: revenueCents,
  };
}

function buildDayBucketsSeries(
  range: { start: Date; end: Date },
  orders: OrderWithAll[],
  dayCount: number
): { xLabels: string[]; data: number[]; orders: number; revenue: number } {
  const placedInRange = orders.filter((o) => inRange(o.placed_at, range.start, range.end));
  const bucketPkr = new Array(dayCount).fill(0);
  let revenueCents = 0;
  const xLabels: string[] = [];

  for (let i = 0; i < dayCount; i++) {
    const day = new Date(range.start);
    day.setDate(day.getDate() + i);
    xLabels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
  }

  for (const o of orders) {
    const rt = deliveredRevenueTime(o);
    if (!rt) continue;
    if (!inRangeDate(rt, range.start, range.end)) continue;
    revenueCents += o.total_cents;
    const dayStart = startOfLocalDay(rt);
    const idx = Math.floor((dayStart.getTime() - range.start.getTime()) / 86400000);
    if (idx >= 0 && idx < dayCount) {
      bucketPkr[idx] += Math.round(o.total_cents / 100);
    }
  }

  return { xLabels, data: bucketPkr, orders: placedInRange.length, revenue: revenueCents };
}

function buildMultiDayChunkSeries(
  range: { start: Date; end: Date },
  orders: OrderWithAll[],
  bucketCount: number
): { xLabels: string[]; data: number[]; orders: number; revenue: number } {
  const placedInRange = orders.filter((o) => inRange(o.placed_at, range.start, range.end));
  const spanMs = range.end.getTime() - range.start.getTime();
  const bucketMs = spanMs / bucketCount;
  const bucketPkr = new Array(bucketCount).fill(0);
  const xLabels: string[] = [];
  let revenueCents = 0;

  for (let i = 0; i < bucketCount; i++) {
    const sliceStart = range.start.getTime() + i * bucketMs;
    const d = new Date(sliceStart);
    xLabels.push(
      d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    );
  }

  for (const o of orders) {
    const rt = deliveredRevenueTime(o);
    if (!rt) continue;
    const t = rt.getTime();
    if (t < range.start.getTime() || t >= range.end.getTime()) continue;
    revenueCents += o.total_cents;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - range.start.getTime()) / bucketMs)));
    bucketPkr[idx] += Math.round(o.total_cents / 100);
  }

  return { xLabels, data: bucketPkr, orders: placedInRange.length, revenue: revenueCents };
}

function buildAllTimeSeries(orders: OrderWithAll[]): { xLabels: string[]; data: number[]; orders: number; revenue: number } {
  if (!orders.length) {
    return { xLabels: [], data: [], orders: 0, revenue: 0 };
  }
  const times = orders.map((o) => new Date(o.placed_at).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times, Date.now());
  const span = Math.max(86400000, maxT - minT);
  const bucketCount = Math.min(18, Math.max(2, Math.ceil(span / (10 * 86400000))));
  const bucketMs = span / bucketCount;
  const bucketPkr = new Array(bucketCount).fill(0);
  const xLabels: string[] = [];
  let revenueCentsAll = 0;

  for (let i = 0; i < bucketCount; i++) {
    const d = new Date(minT + i * bucketMs);
    xLabels.push(
      `${d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`
    );
  }

  for (const o of orders) {
    if (o.status === 'delivered') {
      revenueCentsAll += o.total_cents;
    }
    const rt = deliveredRevenueTime(o);
    if (!rt) continue;
    const t = rt.getTime();
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - minT) / bucketMs)));
    bucketPkr[idx] += Math.round(o.total_cents / 100);
  }

  const padded = padSeriesForChart(xLabels, bucketPkr);
  return {
    xLabels: padded.xLabels,
    data: padded.data,
    orders: orders.length,
    revenue: revenueCentsAll,
  };
}

/**
 * Get time-series order and revenue data for charting (filtered by the same range as dashboard chips).
 */
export async function getShopOrderTimeSeries(
  shopId: string,
  timeFilter: 'today' | 'yesterday' | '7days' | '30days' | 'all_time' | 'custom',
  customStartDate?: Date,
  customEndDate?: Date
): Promise<{
  xLabels: string[];
  data: number[];
  orders: number;
  revenue: number;
}> {
  const orders = await getShopOrders(shopId);
  if (!orders.length) {
    return { xLabels: [], data: [], orders: 0, revenue: 0 };
  }

  if (timeFilter === 'all_time') {
    return buildAllTimeSeries(orders);
  }

  const range = getTimeSeriesRange(timeFilter, customStartDate, customEndDate);
  if (!range) {
    return { xLabels: [], data: [], orders: 0, revenue: 0 };
  }

  let raw: { xLabels: string[]; data: number[]; orders: number; revenue: number };

  if (timeFilter === 'today' || timeFilter === 'yesterday') {
    raw = buildTodayYesterdaySeries(range, orders);
  } else if (timeFilter === '7days') {
    raw = buildDayBucketsSeries(range, orders, 7);
  } else if (timeFilter === '30days') {
    raw = buildMultiDayChunkSeries(range, orders, 10);
  } else {
    raw = buildMultiDayChunkSeries(range, orders, 8);
  }

  const padded = padSeriesForChart(raw.xLabels, raw.data);
  return {
    xLabels: padded.xLabels,
    data: padded.data,
    orders: raw.orders,
    revenue: raw.revenue,
  };
}

// ============================================================================
// REALTIME SUBSCRIPTION
// ============================================================================

/**
 * Subscribe to shop orders
 */
export function subscribeToShopOrders(
  shopId: string,
  callback: (orders: OrderWithAll[]) => void
) {
  let cleanup: (() => Promise<void>) | null = null;
  (async () => {
    cleanup = await subscribeToShopGroup(shopId, async () => {
      callback(await getShopOrders(shopId));
    });
  })().catch((error) => console.warn('Shop order realtime subscribe failed', error));
  return () => {
    if (cleanup) {
      cleanup().catch(() => undefined);
    }
  };
}

