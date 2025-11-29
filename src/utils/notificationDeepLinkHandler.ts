import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

export interface NotificationData {
  type: string;
  orderId: string;
  shopId?: string;
  status?: string;
  customerName?: string;
  landmark?: string;
}

/**
 * Handle navigation from notification tap
 */
export function handleNotificationNavigation(
  data: NotificationData,
  navigation: NavigationProp<RootStackParamList>
): void {
  if (!data || !data.type) {
    console.warn('Invalid notification data:', data);
    return;
  }

  try {
    if (data.type === 'order_status' || data.type === 'active_order') {
      // Consumer order status notification (regular or persistent)
      if (data.orderId) {
        navigation.navigate('OrderStatus', { orderId: data.orderId });
      }
    } else if (data.type === 'new_order' || data.type === 'order_cancelled') {
      // Merchant order notification
      if (data.orderId && data.shopId) {
        navigation.navigate('MerchantOrder', {
          shopId: data.shopId,
          orderId: data.orderId,
        });
      }
    } else {
      console.warn('Unknown notification type:', data.type);
    }
  } catch (error) {
    console.error('Error navigating from notification:', error);
  }
}

