/**
 * Order Service
 * 
 * Handles all order-related operations including placing orders,
 * tracking status, and managing order lifecycle.
 */

import { supabase } from '../supabase';
import {
  Order,
  OrderWithItems,
  OrderWithAll,
  PlaceOrderRequest,
  PlaceOrderResponse,
  OrderItem,
  DeliveryAddress,
  OrderCalculation,
} from '../../types/orders';

// ============================================================================
// PLACE ORDER
// ============================================================================

/**
 * Calculate order totals including delivery fee and surcharge
 */
export async function calculateOrderTotals(
  shopId: string,
  items: Array<{ merchant_item_id: string; quantity: number }>,
  addressId: string
): Promise<OrderCalculation> {
  try {
    // Get item prices
    const itemIds = items.map((item) => item.merchant_item_id);
    const { data: merchantItems, error: itemsError } = await supabase
      .from('merchant_items')
      .select('id, price_cents')
      .in('id', itemIds);

    if (itemsError) throw itemsError;

    // Calculate subtotal
    let subtotal_cents = 0;
    items.forEach((item) => {
      const merchantItem = merchantItems?.find((mi) => mi.id === item.merchant_item_id);
      if (merchantItem) {
        subtotal_cents += merchantItem.price_cents * item.quantity;
      }
    });

    // Get delivery logic
    const { data: deliveryLogic, error: logicError } = await supabase
      .from('shop_delivery_logic')
      .select('*')
      .eq('shop_id', shopId)
      .single();

    if (logicError) throw logicError;

    // Get address for distance calculation
    const { data: address, error: addressError } = await supabase
      .from('consumer_addresses')
      .select('latitude, longitude')
      .eq('id', addressId)
      .single();

    if (addressError) throw addressError;

    // Get shop location
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('latitude, longitude')
      .eq('id', shopId)
      .single();

    if (shopError) throw shopError;

    // Calculate distance using Haversine formula
    const distance_meters = calculateDistance(
      address.latitude,
      address.longitude,
      shop.latitude,
      shop.longitude
    );

    // Calculate delivery fee based on distance tiers
    let delivery_fee_cents = 0;
    const tiers = deliveryLogic.distance_tiers as Array<{
      max_distance: number;
      fee: number;
    }>;

    // Check if within free delivery radius
    if (
      subtotal_cents >= deliveryLogic.free_delivery_threshold * 100 &&
      distance_meters <= deliveryLogic.free_delivery_radius
    ) {
      delivery_fee_cents = 0;
    } else {
      // Find appropriate tier
      let tierFound = false;
      for (const tier of tiers) {
        if (distance_meters <= tier.max_distance) {
          delivery_fee_cents = tier.fee * 100; // Convert to cents
          tierFound = true;
          break;
        }
      }

      // If beyond all tiers, calculate using beyond_tier formula
      if (!tierFound) {
        const lastTier = tiers[tiers.length - 1];
        const excessDistance = distance_meters - lastTier.max_distance;
        const excessUnits = Math.ceil(
          excessDistance / deliveryLogic.beyond_tier_distance_unit
        );
        delivery_fee_cents =
          lastTier.fee * 100 +
          excessUnits * deliveryLogic.beyond_tier_fee_per_unit * 100;
      }

      // Cap at max delivery fee
      delivery_fee_cents = Math.min(
        delivery_fee_cents,
        deliveryLogic.max_delivery_fee * 100
      );
    }

    // Calculate surcharge for small orders
    let surcharge_cents = 0;
    if (subtotal_cents < deliveryLogic.minimum_order_value * 100) {
      surcharge_cents = deliveryLogic.small_order_surcharge * 100;
    }

    const total_cents = subtotal_cents + delivery_fee_cents + surcharge_cents;

    return {
      subtotal_cents,
      delivery_fee_cents,
      surcharge_cents,
      total_cents,
      distance_meters,
    };
  } catch (error) {
    console.error('Error calculating order totals:', error);
    throw error;
  }
}

/**
 * Haversine formula to calculate distance between two coordinates
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Place a new order
 */
export async function placeOrder(
  request: PlaceOrderRequest
): Promise<PlaceOrderResponse> {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    // Get address details for snapshot
    const { data: address, error: addressError } = await supabase
      .from('consumer_addresses')
      .select('*')
      .eq('id', request.consumer_address_id)
      .single();

    if (addressError) throw addressError;

    // Calculate totals
    const calculation = await calculateOrderTotals(
      request.shop_id,
      request.items,
      request.consumer_address_id
    );

    // Check minimum order value
    const { data: deliveryLogic } = await supabase
      .from('shop_delivery_logic')
      .select('least_order_value')
      .eq('shop_id', request.shop_id)
      .single();

    if (
      deliveryLogic &&
      calculation.subtotal_cents < deliveryLogic.least_order_value * 100
    ) {
      return {
        success: false,
        message: `Minimum order value is PKR ${deliveryLogic.least_order_value}`,
        order: null as any,
      };
    }

    // Get item details for snapshots
    const itemIds = request.items.map((item) => item.merchant_item_id);
    const { data: merchantItems, error: itemsError } = await supabase
      .from('merchant_items')
      .select('id, name, description, image_url, price_cents')
      .in('id', itemIds);

    if (itemsError) throw itemsError;

    // Create delivery address snapshot
    const deliveryAddressSnapshot: DeliveryAddress = {
      id: address.id,
      title: address.title,
      street_address: address.street_address,
      city: address.city,
      region: address.region,
      latitude: address.latitude,
      longitude: address.longitude,
      landmark: address.landmark,
      formatted_address: address.formatted_address,
    };

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        shop_id: request.shop_id,
        user_id: user.id,
        consumer_address_id: request.consumer_address_id,
        status: 'pending',
        subtotal_cents: calculation.subtotal_cents,
        delivery_fee_cents: calculation.delivery_fee_cents,
        surcharge_cents: calculation.surcharge_cents,
        total_cents: calculation.total_cents,
        payment_method: request.payment_method,
        special_instructions: request.special_instructions,
        delivery_address: deliveryAddressSnapshot,
        customer_name: profile?.name,
        customer_email: profile?.email,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItemsToInsert = request.items.map((item) => {
      const merchantItem = merchantItems?.find(
        (mi) => mi.id === item.merchant_item_id
      );
      if (!merchantItem) throw new Error('Merchant item not found');

      return {
        order_id: order.id,
        merchant_item_id: item.merchant_item_id,
        item_name: merchantItem.name || '',
        item_description: merchantItem.description,
        item_image_url: merchantItem.image_url,
        item_price_cents: merchantItem.price_cents,
        quantity: item.quantity,
        subtotal_cents: merchantItem.price_cents * item.quantity,
      };
    });

    const { data: orderItems, error: itemsInsertError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert)
      .select();

    if (itemsInsertError) throw itemsInsertError;

    return {
      success: true,
      order: {
        ...order,
        order_items: orderItems,
      } as OrderWithItems,
    };
  } catch (error) {
    console.error('Error placing order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to place order',
      order: null as any,
    };
  }
}

// ============================================================================
// GET ORDERS
// ============================================================================

/**
 * Get all orders for the current user
 */
export async function getUserOrders(): Promise<OrderWithAll[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

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
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false });

    if (error) throw error;

    return (data || []) as any;
  } catch (error) {
    console.error('Error getting user orders:', error);
    return [];
  }
}

/**
 * Get a single order by ID
 */
export async function getOrderById(orderId: string): Promise<OrderWithAll | null> {
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
      .eq('id', orderId)
      .single();

    if (error) throw error;

    return data as any;
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
}

/**
 * Get active order for current user (non-terminal status)
 */
export async function getActiveOrder(): Promise<OrderWithAll | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

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
      .eq('user_id', user.id)
      .not('status', 'in', '(delivered,cancelled)')
      .order('placed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No active order is not an error
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as any;
  } catch (error) {
    console.error('Error getting active order:', error);
    return null;
  }
}

// ============================================================================
// REALTIME SUBSCRIPTION
// ============================================================================

/**
 * Subscribe to order updates
 */
export function subscribeToOrder(
  orderId: string,
  callback: (order: Order) => void
) {
  const channel = supabase
    .channel(`order:${orderId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        callback(payload.new as Order);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to active orders for current user
 */
export function subscribeToUserOrders(callback: (orders: Order[]) => void) {
  const channel = supabase
    .channel('user-orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      async () => {
        // Refetch all orders on any change
        const orders = await getUserOrders();
        callback(orders);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// CANCEL ORDER (CONSUMER)
// ============================================================================

/**
 * Cancel an order (consumer side)
 */
export async function cancelOrder(
  orderId: string,
  reason?: string
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
        cancellation_reason: reason || 'Cancelled by customer',
        cancelled_by: user.id,
      })
      .eq('id', orderId)
      .eq('user_id', user.id);

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

