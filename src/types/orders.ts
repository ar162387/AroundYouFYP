/**
 * Order Management Types
 * 
 * Comprehensive type definitions for the order management system including
 * order statuses, payment methods, and all related entities.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'wallet';

// ============================================================================
// ADDRESS SNAPSHOT
// ============================================================================

export interface DeliveryAddress {
  id: string;
  title?: 'home' | 'office';
  street_address: string;
  city: string;
  region?: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  formatted_address?: string;
}

// ============================================================================
// ORDER ITEM
// ============================================================================

export interface OrderItem {
  id: string;
  order_id: string;
  merchant_item_id: string;
  
  // Snapshot data (preserved at order time)
  item_name: string;
  item_description?: string;
  item_image_url?: string;
  item_price_cents: number;
  
  // Order specifics
  quantity: number;
  subtotal_cents: number;
  
  created_at: string;
}

// ============================================================================
// ORDER
// ============================================================================

export interface Order {
  id: string;
  order_number: string;
  
  // References
  shop_id: string;
  user_id: string;
  consumer_address_id: string;
  delivery_runner_id?: string;
  
  // Status
  status: OrderStatus;
  
  // Pricing (in cents)
  subtotal_cents: number;
  delivery_fee_cents: number;
  surcharge_cents: number;
  total_cents: number;
  
  // Payment
  payment_method: PaymentMethod;
  
  // Customer notes
  special_instructions?: string;
  
  // Status timestamps
  placed_at: string;
  confirmed_at?: string;
  out_for_delivery_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  
  // Calculated durations (in seconds)
  confirmation_time_seconds?: number;
  preparation_time_seconds?: number;
  delivery_time_seconds?: number;
  
  // Cancellation
  cancellation_reason?: string;
  cancelled_by?: string;
  
  // Snapshots
  delivery_address: DeliveryAddress;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface OrderWithShop extends Order {
  shop: {
    id: string;
    name: string;
    image_url?: string;
    shop_type: string;
    address: string;
  };
}

export interface OrderWithRunner extends Order {
  delivery_runner?: {
    id: string;
    name: string;
    phone_number: string;
  };
}

export interface OrderWithAll extends Order {
  order_items: OrderItem[];
  shop: {
    id: string;
    name: string;
    image_url?: string;
    shop_type: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  delivery_runner?: {
    id: string;
    name: string;
    phone_number: string;
  };
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface PlaceOrderRequest {
  shop_id: string;
  consumer_address_id: string;
  items: Array<{
    merchant_item_id: string;
    quantity: number;
  }>;
  payment_method: PaymentMethod;
  special_instructions?: string;
}

export interface PlaceOrderResponse {
  order: OrderWithItems;
  success: boolean;
  message?: string;
}

export interface UpdateOrderStatusRequest {
  order_id: string;
  new_status: OrderStatus;
  cancellation_reason?: string;
}

export interface AssignRunnerRequest {
  order_id: string;
  delivery_runner_id: string;
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

export interface OrderTimerState {
  elapsedSeconds: number;
  stage: 'confirmation' | 'preparation' | 'delivery';
  isActive: boolean;
}

export interface OrderStatusDisplay {
  status: OrderStatus;
  title: string;
  description: string;
  icon: string;
  color: string;
  showTimer: boolean;
  allowCancel: boolean;
}

export type OrderTimeFilter = 
  | 'today' 
  | 'yesterday' 
  | '7days' 
  | '30days' 
  | 'all' 
  | 'custom';

export interface OrderFilters {
  timeFilter: OrderTimeFilter;
  statusFilter?: OrderStatus;
  customStartDate?: Date;
  customEndDate?: Date;
}

// ============================================================================
// RUNNER STATUS
// ============================================================================

export interface DeliveryRunnerWithStatus {
  id: string;
  shop_id: string;
  name: string;
  phone_number: string;
  is_available: boolean;
  current_order_id?: string;
  current_order_number?: string;
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface OrderAnalytics {
  total_orders: number;
  total_revenue_cents: number;
  average_order_value_cents: number;
  average_confirmation_time_seconds?: number;
  average_preparation_time_seconds?: number;
  average_delivery_time_seconds?: number;
  status_breakdown: Record<OrderStatus, number>;
}

// ============================================================================
// CART TYPES (for checkout)
// ============================================================================

export interface CartItem {
  merchant_item_id: string;
  name: string;
  description?: string;
  image_url?: string;
  price_cents: number;
  quantity: number;
}

export interface Cart {
  shop_id: string;
  items: CartItem[];
}

export interface OrderCalculation {
  subtotal_cents: number;
  delivery_fee_cents: number;
  surcharge_cents: number;
  total_cents: number;
  distance_meters: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'cancelled';
}

export function canTransitionTo(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['out_for_delivery', 'cancelled'],
    out_for_delivery: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  };
  
  return validTransitions[currentStatus].includes(newStatus);
}

export function getOrderStage(status: OrderStatus): 'confirmation' | 'preparation' | 'delivery' | 'complete' {
  switch (status) {
    case 'pending':
      return 'confirmation';
    case 'confirmed':
      return 'preparation';
    case 'out_for_delivery':
      return 'delivery';
    case 'delivered':
    case 'cancelled':
      return 'complete';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatPrice(cents: number, currency: string = 'PKR'): string {
  const amount = (cents / 100).toFixed(2);
  return `${currency} ${amount}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function getOrderStatusDisplay(status: OrderStatus): OrderStatusDisplay {
  const displays: Record<OrderStatus, OrderStatusDisplay> = {
    pending: {
      status: 'pending',
      title: 'Pending Confirmation',
      description: 'Waiting for shop to confirm your order',
      icon: 'clock',
      color: '#F59E0B',
      showTimer: true,
      allowCancel: true,
    },
    confirmed: {
      status: 'confirmed',
      title: 'Preparing Your Order',
      description: 'Shop is preparing your items',
      icon: 'chef',
      color: '#3B82F6',
      showTimer: true,
      allowCancel: true,
    },
    out_for_delivery: {
      status: 'out_for_delivery',
      title: 'Out for Delivery',
      description: 'Your order is on the way',
      icon: 'truck',
      color: '#8B5CF6',
      showTimer: true,
      allowCancel: false,
    },
    delivered: {
      status: 'delivered',
      title: 'Delivered',
      description: 'Your order has been delivered',
      icon: 'check-circle',
      color: '#10B981',
      showTimer: false,
      allowCancel: false,
    },
    cancelled: {
      status: 'cancelled',
      title: 'Cancelled',
      description: 'This order was cancelled',
      icon: 'x-circle',
      color: '#EF4444',
      showTimer: false,
      allowCancel: false,
    },
  };
  
  return displays[status];
}

