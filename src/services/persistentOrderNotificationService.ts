/**
 * Persistent Order Notification Service
 * 
 * Manages a persistent, non-dismissible notification that tracks order status
 * in real-time. The notification appears when order is confirmed and updates
 * automatically as status changes. It's removed only when order is delivered
 * or cancelled.
 */

import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { supabase } from './supabase';
import { subscribeToUserOrders, getActiveOrder } from './consumer/orderService';
import type { OrderWithAll } from '../types/orders';

const PERSISTENT_NOTIFICATION_ID = 'active_order_notification';
let currentOrderId: string | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Get notification title and body based on order status
 */
function getNotificationContent(order: OrderWithAll): { title: string; body: string; progress: number } {
  const shopName = order.shop?.name || 'Your order';
  
  switch (order.status) {
    case 'confirmed':
      return {
        title: 'Order Confirmed',
        body: `${shopName} is preparing your order`,
        progress: 50,
      };
    case 'out_for_delivery':
      const runnerName = order.delivery_runner?.name || 'Delivery runner';
      return {
        title: 'Out for Delivery',
        body: `${runnerName} is on the way to deliver your order`,
        progress: 75,
      };
    case 'delivered':
      return {
        title: 'Order Delivered',
        body: 'Your order has been delivered. Enjoy!',
        progress: 100,
      };
    case 'cancelled':
      return {
        title: 'Order Cancelled',
        body: 'Your order has been cancelled',
        progress: 0,
      };
    default:
      return {
        title: 'Order Update',
        body: `Your order from ${shopName} is being processed`,
        progress: 25,
      };
  }
}

/**
 * Display or update persistent order notification
 */
async function updatePersistentNotification(order: OrderWithAll | null): Promise<void> {
  try {
    // If no order or order is terminal, cancel notification
    if (!order || order.status === 'delivered' || order.status === 'cancelled') {
      await notifee.cancelNotification(PERSISTENT_NOTIFICATION_ID);
      currentOrderId = null;
      console.log('[PersistentNotification] Notification cancelled - order terminal');
      return;
    }

    // Only show persistent notification for confirmed orders and beyond
    if (order.status !== 'confirmed' && order.status !== 'out_for_delivery') {
      // Order is pending - wait for confirmation
      return;
    }

    const { title, body, progress } = getNotificationContent(order);
    
    // Build notification body with runner info if out for delivery
    let notificationBody = body;
    if (order.status === 'out_for_delivery' && order.delivery_runner) {
      const runnerName = order.delivery_runner.name || 'Delivery runner';
      notificationBody = `${runnerName} is on the way to deliver your order from ${order.shop?.name || 'shop'}`;
    }

    // Update or create persistent notification
    await notifee.displayNotification({
      id: PERSISTENT_NOTIFICATION_ID,
      title,
      body: notificationBody,
      data: {
        type: 'active_order',
        orderId: order.id,
        status: order.status,
      },
      android: {
        channelId: 'order_notifications',
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_notification', // White icon with transparent background
        ongoing: true, // Makes it non-dismissible
        autoCancel: false, // Cannot be dismissed by user
        progress: {
          max: 100,
          current: progress,
        },
        pressAction: {
          id: 'default',
        },
        sound: 'default',
        showTimestamp: true,
      },
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
      },
    });

    currentOrderId = order.id;
    console.log(`[PersistentNotification] Notification updated for order ${order.id} - Status: ${order.status}`);
  } catch (error) {
    console.error('[PersistentNotification] Error updating notification:', error);
  }
}

/**
 * Check and update persistent notification for active order
 */
async function checkAndUpdateNotification(): Promise<void> {
  try {
    const activeOrder = await getActiveOrder();
    await updatePersistentNotification(activeOrder);
  } catch (error) {
    console.error('[PersistentNotification] Error checking active order:', error);
    await updatePersistentNotification(null);
  }
}

/**
 * Start monitoring active orders and updating persistent notification
 */
export function startPersistentOrderNotification(): () => void {
  // Cancel any existing notification
  notifee.cancelNotification(PERSISTENT_NOTIFICATION_ID);

  // Check immediately for active order
  checkAndUpdateNotification();

  // Subscribe to order updates
  unsubscribe = subscribeToUserOrders(async () => {
    // When any order changes, check if we have an active order
    await checkAndUpdateNotification();
  });

  console.log('[PersistentNotification] Started monitoring active orders');

  // Return cleanup function
  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    notifee.cancelNotification(PERSISTENT_NOTIFICATION_ID);
    currentOrderId = null;
    console.log('[PersistentNotification] Stopped monitoring active orders');
  };
}

/**
 * Manually trigger persistent notification update (called when push notification received)
 */
export async function refreshPersistentNotification(): Promise<void> {
  await checkAndUpdateNotification();
}

/**
 * Stop monitoring and cancel persistent notification
 */
export async function stopPersistentOrderNotification(): Promise<void> {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  await notifee.cancelNotification(PERSISTENT_NOTIFICATION_ID);
  currentOrderId = null;
  console.log('[PersistentNotification] Stopped and cancelled notification');
}

