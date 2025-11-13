/**
 * Merchant Order Service
 * 
 * Handles merchant-side order operations including status updates,
 * runner assignment, and order management.
 */

import { supabase } from '../supabase';
import {
  Order,
  OrderWithAll,
  OrderStatus,
  DeliveryRunnerWithStatus,
  OrderFilters,
  OrderAnalytics,
} from '../../types/orders';

// ============================================================================
// GET SHOP ORDERS
// ============================================================================

/**
 * Get all orders for a shop
 */
export async function getShopOrders(shopId: string): Promise<OrderWithAll[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items(*),
        shop:shops(id, name, image_url, shop_type, address, latitude, longitude),
        delivery_runner:delivery_runners(id, name, phone_number)
      `
      )
      .eq('shop_id', shopId)
      .order('placed_at', { ascending: false });

    if (error) throw error;

    return (data || []) as any;
  } catch (error) {
    console.error('Error getting shop orders:', error);
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
    let query = supabase
      .from('orders')
      .select(
        `
        *,
        order_items(*),
        shop:shops(id, name, image_url, shop_type, address, latitude, longitude),
        delivery_runner:delivery_runners(id, name, phone_number)
      `
      )
      .eq('shop_id', shopId);

    // Apply status filter
    if (filters.statusFilter) {
      query = query.eq('status', filters.statusFilter);
    }

    // Apply time filter
    const now = new Date();
    let startDate: Date | undefined;

    switch (filters.timeFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte('placed_at', startDate.toISOString());
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        const endOfYesterday = new Date(startDate);
        endOfYesterday.setDate(endOfYesterday.getDate() + 1);
        query = query
          .gte('placed_at', startDate.toISOString())
          .lt('placed_at', endOfYesterday.toISOString());
        break;
      case '7days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        query = query.gte('placed_at', startDate.toISOString());
        break;
      case '30days':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        query = query.gte('placed_at', startDate.toISOString());
        break;
      case 'custom':
        if (filters.customStartDate) {
          query = query.gte('placed_at', filters.customStartDate.toISOString());
        }
        if (filters.customEndDate) {
          const endDate = new Date(filters.customEndDate);
          endDate.setDate(endDate.getDate() + 1); // Include end date
          query = query.lt('placed_at', endDate.toISOString());
        }
        break;
      case 'all':
      default:
        // No time filter
        break;
    }

    query = query.order('placed_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as any;
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
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        // confirmed_at is set automatically by validate_order_status_transition trigger
      })
      .eq('id', orderId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error confirming order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to confirm order',
    };
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
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'out_for_delivery',
        delivery_runner_id: runnerId,
        // out_for_delivery_at is set automatically by validate_order_status_transition trigger
      })
      .eq('id', orderId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error assigning runner:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to assign runner',
    };
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
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        // delivered_at is set automatically by validate_order_status_transition trigger
      })
      .eq('id', orderId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error marking order as delivered:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to mark order as delivered',
    };
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: user.id,
      })
      .eq('id', orderId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error cancelling order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel order',
    };
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
    // Get all runners for the shop
    const { data: runners, error: runnersError } = await supabase
      .from('delivery_runners')
      .select('*')
      .eq('shop_id', shopId)
      .order('name');

    if (runnersError) throw runnersError;

    // Get active orders for runners
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, delivery_runner_id, status')
      .eq('shop_id', shopId)
      .in('status', ['confirmed', 'out_for_delivery']);

    if (ordersError) throw ordersError;

    // Build runner status map
    const runnerOrderMap = new Map<
      string,
      { order_id: string; order_number: string }
    >();
    activeOrders?.forEach((order) => {
      if (order.delivery_runner_id && order.status === 'out_for_delivery') {
        runnerOrderMap.set(order.delivery_runner_id, {
          order_id: order.id,
          order_number: order.order_number,
        });
      }
    });

    // Combine data
    const runnersWithStatus: DeliveryRunnerWithStatus[] =
      runners?.map((runner) => {
        const currentOrder = runnerOrderMap.get(runner.id);
        return {
          id: runner.id,
          shop_id: runner.shop_id,
          name: runner.name,
          phone_number: runner.phone_number,
          is_available: !currentOrder,
          current_order_id: currentOrder?.order_id,
          current_order_number: currentOrder?.order_number,
        };
      }) || [];

    return runnersWithStatus;
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
    let query = supabase
      .from('orders')
      .select('status, total_cents, confirmation_time_seconds, preparation_time_seconds, delivery_time_seconds, confirmed_at, out_for_delivery_at, delivered_at, placed_at')
      .eq('shop_id', shopId);

    // Apply time filter if provided
    if (timeFilter && timeFilter !== 'all') {
      const now = new Date();
      let startDate: Date | undefined;

      switch (timeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = new Date(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate()
          );
          const endOfYesterday = new Date(startDate);
          endOfYesterday.setDate(endOfYesterday.getDate() + 1);
          query = query
            .gte('placed_at', startDate.toISOString())
            .lt('placed_at', endOfYesterday.toISOString());
          break;
        case '7days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      if (startDate && timeFilter !== 'yesterday') {
        query = query.gte('placed_at', startDate.toISOString());
      }
    }

    // Handle custom date range
    if (customStartDate) {
      query = query.gte('placed_at', customStartDate.toISOString());
    }
    if (customEndDate) {
      const end = new Date(customEndDate);
      end.setDate(end.getDate() + 1);
      query = query.lt('placed_at', end.toISOString());
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return {
        total_orders: 0,
        total_revenue_cents: 0,
        average_order_value_cents: 0,
        status_breakdown: {
          pending: 0,
          confirmed: 0,
          out_for_delivery: 0,
          delivered: 0,
          cancelled: 0,
        },
      };
    }

    // Calculate metrics
    const total_orders = orders.length;
    const total_revenue_cents = orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total_cents, 0);
    const average_order_value_cents =
      total_orders > 0 ? Math.round(total_revenue_cents / total_orders) : 0;

    // Status breakdown
    const status_breakdown: Record<OrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    };
    orders.forEach((order) => {
      status_breakdown[order.status as OrderStatus]++;
    });

    // Calculate average times (only for delivered orders)
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    let average_confirmation_time_seconds: number | undefined;
    let average_preparation_time_seconds: number | undefined;
    let average_delivery_time_seconds: number | undefined;

    console.log('Delivered orders count:', deliveredOrders.length);
    console.log('Sample delivered order:', deliveredOrders[0]);

    if (deliveredOrders.length > 0) {
      // Try to get times from the calculated fields first
      let confirmationTimes = deliveredOrders
        .filter((o) => o.confirmation_time_seconds !== null && o.confirmation_time_seconds !== undefined)
        .map((o) => o.confirmation_time_seconds!);
      
      let preparationTimes = deliveredOrders
        .filter((o) => o.preparation_time_seconds !== null && o.preparation_time_seconds !== undefined)
        .map((o) => o.preparation_time_seconds!);
      
      let deliveryTimes = deliveredOrders
        .filter((o) => o.delivery_time_seconds !== null && o.delivery_time_seconds !== undefined)
        .map((o) => o.delivery_time_seconds!);

      // If calculated times are missing, calculate from timestamps
      if (confirmationTimes.length === 0) {
        confirmationTimes = deliveredOrders
          .filter((o) => o.confirmed_at && o.placed_at)
          .map((o) => {
            const confirmed = new Date(o.confirmed_at!);
            const placed = new Date(o.placed_at);
            return Math.round((confirmed.getTime() - placed.getTime()) / 1000);
          });
      }

      if (preparationTimes.length === 0) {
        preparationTimes = deliveredOrders
          .filter((o) => o.out_for_delivery_at && o.confirmed_at)
          .map((o) => {
            const outForDelivery = new Date(o.out_for_delivery_at!);
            const confirmed = new Date(o.confirmed_at!);
            return Math.round((outForDelivery.getTime() - confirmed.getTime()) / 1000);
          });
      }

      if (deliveryTimes.length === 0) {
        deliveryTimes = deliveredOrders
          .filter((o) => o.delivered_at && o.out_for_delivery_at)
          .map((o) => {
            const delivered = new Date(o.delivered_at!);
            const outForDelivery = new Date(o.out_for_delivery_at!);
            return Math.round((delivered.getTime() - outForDelivery.getTime()) / 1000);
          });
      }

      console.log('Confirmation times:', confirmationTimes);
      console.log('Preparation times:', preparationTimes);
      console.log('Delivery times:', deliveryTimes);

      if (confirmationTimes.length > 0) {
        average_confirmation_time_seconds = Math.round(
          confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length
        );
      }
      if (preparationTimes.length > 0) {
        average_preparation_time_seconds = Math.round(
          preparationTimes.reduce((a, b) => a + b, 0) / preparationTimes.length
        );
      }
      if (deliveryTimes.length > 0) {
        average_delivery_time_seconds = Math.round(
          deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        );
      }
    }

    return {
      total_orders,
      total_revenue_cents,
      average_order_value_cents,
      average_confirmation_time_seconds,
      average_preparation_time_seconds,
      average_delivery_time_seconds,
      status_breakdown,
    };
  } catch (error) {
    console.error('Error getting shop order analytics:', error);
    return null;
  }
}

/**
 * Get time-series order and revenue data for charting
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
  try {
    let query = supabase
      .from('orders')
      .select('placed_at, total_cents, status')
      .eq('shop_id', shopId);

    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    // Apply time filter
    switch (timeFilter) {
      case 'today': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte('placed_at', startDate.toISOString());
        break;
      }
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        query = query
          .gte('placed_at', startDate.toISOString())
          .lt('placed_at', endDate.toISOString());
        break;
      }
      case '7days': {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        query = query.gte('placed_at', startDate.toISOString());
        break;
      }
      case '30days': {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        query = query.gte('placed_at', startDate.toISOString());
        break;
      }
      case 'custom': {
        if (customStartDate) {
          query = query.gte('placed_at', customStartDate.toISOString());
          startDate = customStartDate;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setDate(end.getDate() + 1);
          query = query.lt('placed_at', end.toISOString());
          endDate = customEndDate;
        }
        break;
      }
      case 'all_time':
      default:
        // No filter
        break;
    }

    query = query.order('placed_at', { ascending: true });

    const { data: orders, error } = await query;

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return {
        xLabels: [],
        data: [],
        orders: 0,
        revenue: 0,
      };
    }

    // Calculate total orders and revenue
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total_cents, 0);

    // Group orders by time period based on filter
    let xLabels: string[] = [];
    let data: number[] = [];
    const dataMap = new Map<string, number>();

    const effectiveStartDate = startDate || (orders[0] ? new Date(orders[0].placed_at) : now);
    const effectiveEndDate = endDate || now;
    const daysDiff = Math.ceil(
      (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine grouping interval
    if (timeFilter === 'today' || timeFilter === 'yesterday' || (timeFilter === 'custom' && daysDiff <= 1)) {
      // Hourly grouping
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      xLabels = hours;
      
      // Initialize all hours with 0
      hours.forEach((hour) => {
        dataMap.set(hour, 0);
      });

      // Group orders by hour
      orders.forEach((order) => {
        const orderDate = new Date(order.placed_at);
        const hour = orderDate.getHours();
        const hourKey = `${String(hour).padStart(2, '0')}:00`;
        
        // Find closest xLabel hour
        const closestHour = hours.reduce((prev, curr) => {
          const prevHour = parseInt(prev.split(':')[0]);
          const currHour = parseInt(curr.split(':')[0]);
          const prevDiff = Math.abs(hour - prevHour);
          const currDiff = Math.abs(hour - currHour);
          return currDiff < prevDiff ? curr : prev;
        });
        
        const currentValue = dataMap.get(closestHour) || 0;
        // Use revenue for chart data (in cents, convert to rupees for display)
        const revenue = order.status === 'delivered' ? order.total_cents : 0;
        dataMap.set(closestHour, currentValue + revenue);
      });
    } else if (daysDiff <= 7) {
      // Daily grouping
      const days: string[] = [];
      const dayMap = new Map<string, number>();
      
      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(effectiveStartDate);
        date.setDate(date.getDate() + i);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateKey = date.toISOString().split('T')[0];
        days.push(dayLabel);
        dayMap.set(dateKey, 0);
      }
      
      xLabels = days;
      
      orders.forEach((order) => {
        const orderDate = new Date(order.placed_at);
        const dateKey = orderDate.toISOString().split('T')[0];
        const currentValue = dayMap.get(dateKey) || 0;
        const revenue = order.status === 'delivered' ? order.total_cents : 0;
        dayMap.set(dateKey, currentValue + revenue);
      });
      
      // Convert map to array in order
      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(effectiveStartDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        data.push(dayMap.get(dateKey) || 0);
      }
    } else if (daysDiff <= 30) {
      // Weekly grouping
      const weeks: string[] = [];
      const weekMap = new Map<string, number>();
      const numWeeks = Math.ceil(daysDiff / 7);
      
      for (let i = 0; i < numWeeks; i++) {
        weeks.push(`Wk${i + 1}`);
        weekMap.set(`week_${i}`, 0);
      }
      
      xLabels = weeks;
      
      orders.forEach((order) => {
        const orderDate = new Date(order.placed_at);
        const weekIndex = Math.floor(
          (orderDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
        );
        const weekKey = `week_${Math.min(weekIndex, numWeeks - 1)}`;
        const currentValue = weekMap.get(weekKey) || 0;
        const revenue = order.status === 'delivered' ? order.total_cents : 0;
        weekMap.set(weekKey, currentValue + revenue);
      });
      
      // Convert map to array
      for (let i = 0; i < numWeeks; i++) {
        data.push(weekMap.get(`week_${i}`) || 0);
      }
    } else {
      // Monthly grouping
      const months: string[] = [];
      const monthMap = new Map<string, number>();
      const numMonths = Math.min(Math.ceil(daysDiff / 30), 12);
      
      for (let i = 0; i < numMonths; i++) {
        const date = new Date(effectiveStartDate);
        date.setMonth(date.getMonth() + i);
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
        months.push(monthLabel);
        monthMap.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, 0);
      }
      
      xLabels = months;
      
      orders.forEach((order) => {
        const orderDate = new Date(order.placed_at);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        const currentValue = monthMap.get(monthKey) || 0;
        const revenue = order.status === 'delivered' ? order.total_cents : 0;
        monthMap.set(monthKey, currentValue + revenue);
      });
      
      // Convert map to array
      for (let i = 0; i < numMonths; i++) {
        const date = new Date(effectiveStartDate);
        date.setMonth(date.getMonth() + i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        data.push(monthMap.get(monthKey) || 0);
      }
    }

    // Convert dataMap to array if using hourly grouping
    if (timeFilter === 'today' || timeFilter === 'yesterday' || (timeFilter === 'custom' && daysDiff <= 1)) {
      data = xLabels.map((label) => dataMap.get(label) || 0);
    }

    // Convert data from cents to rupees for display (divide by 100)
    const dataInRupees = data.map((value) => Math.round(value / 100));
    
    // Generate yLabels based on max value (in rupees)
    const maxValue = Math.max(...dataInRupees, 1);
    const yMax = Math.ceil(maxValue / 1000) * 1000 || 1000;
    const yLabels = Array.from({ length: 5 }, (_, i) => Math.floor((yMax / 4) * i));

    return {
      xLabels,
      data: dataInRupees,
      orders: totalOrders,
      revenue: totalRevenue, // Keep in cents for accurate calculation
    };
  } catch (error) {
    console.error('Error getting shop order time series:', error);
    return {
      xLabels: [],
      data: [],
      orders: 0,
      revenue: 0,
    };
  }
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
  const channel = supabase
    .channel(`shop-orders:${shopId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `shop_id=eq.${shopId}`,
      },
      async () => {
        // Refetch all orders on any change
        const orders = await getShopOrders(shopId);
        callback(orders);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

