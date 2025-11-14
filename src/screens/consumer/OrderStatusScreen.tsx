import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useOrder, useCancelOrder } from '../../hooks/consumer/useOrders';
import { getOrderStatusDisplay, formatPrice } from '../../types/orders';
import BackIcon from '../../icons/BackIcon';
import DeliveryRunnerIcon from '../../icons/DeliveryRunnerIcon';
import {
  OrderPendingIcon,
  OrderConfirmedIcon,
  OrderOutForDeliveryIcon,
  OrderDeliveredIcon,
  OrderCancelledIcon,
} from '../../icons/OrderStatusIcons';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OrderStatus'>;

export default function OrderStatusScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { orderId } = route.params;

  const { data: order, isLoading } = useOrder(orderId);
  const cancelOrderMutation = useCancelOrder();

  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const result = await cancelOrderMutation.mutateAsync({
              orderId,
              reason: 'Cancelled by customer',
            });
            if (result.success) {
              Alert.alert('Order Cancelled', 'Your order has been cancelled.');
            } else {
              Alert.alert('Error', result.message || 'Failed to cancel order');
            }
          },
        },
      ]
    );
  };

  const handleCallRunner = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;

    if (order && order.status !== 'delivered' && order.status !== 'cancelled') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      animation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      animation?.stop();
    };
  }, [order?.status, pulseAnim]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">Loading order...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-6xl mb-4">📦</Text>
        <Text className="text-gray-900 text-lg font-semibold mb-2">Order not found</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-4 bg-blue-600 px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusDisplay = getOrderStatusDisplay(order.status);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <SafeAreaView edges={['top']} className="bg-white border-b border-gray-200">
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            activeOpacity={0.7}
          >
            <BackIcon size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-gray-900 text-lg font-bold">Order Status</Text>
            <Text className="text-gray-500 text-sm">{order.order_number}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <View className="bg-white rounded-2xl p-6 mb-4 items-center">
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
            }}
          >
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: `${statusDisplay.color}20` }}
            >
              {getStatusIcon(order.status, statusDisplay.color)}
            </View>
          </Animated.View>

          <Text
            className="text-2xl font-bold mb-2"
            style={{ color: statusDisplay.color }}
          >
            {statusDisplay.title}
          </Text>
          <Text className="text-gray-600 text-center mb-4">
            {statusDisplay.description}
          </Text>

        </View>

        {/* Delivery Runner Info (if out for delivery or delivered) */}
        {order.delivery_runner && (order.status === 'out_for_delivery' || order.status === 'delivered') && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <DeliveryRunnerIcon size={20} color="#111827" />
              <Text className="text-lg font-bold text-gray-900 ml-2">Delivery Runner</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-gray-900 text-base font-semibold">
                  {order.delivery_runner.name}
                </Text>
                <Text className="text-gray-600 text-sm">{order.delivery_runner.phone_number}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCallRunner(order.delivery_runner!.phone_number)}
                className="bg-blue-600 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Shop Info */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Shop Details</Text>
          <Text className="text-gray-900 text-base font-semibold">{order.shop.name}</Text>
          <Text className="text-gray-600 text-sm mt-1">{order.shop.shop_type}</Text>
          <Text className="text-gray-600 text-sm mt-1">{order.shop.address}</Text>
        </View>

        {/* Delivery Address */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Delivery Address</Text>
          <Text className="text-gray-900 text-base">
            {order.delivery_address.street_address}
          </Text>
          <Text className="text-gray-600 text-sm mt-1">
            {order.delivery_address.city}
            {order.delivery_address.region && `, ${order.delivery_address.region}`}
          </Text>
          {order.delivery_address.landmark && (
            <View className="mt-2">
              <Text className="text-xs text-gray-500">Landmark</Text>
              <Text className="text-gray-700 text-sm">{order.delivery_address.landmark}</Text>
            </View>
          )}
        </View>

        {/* Special Instructions */}
        {order.special_instructions && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-2">Special Instructions</Text>
            <Text className="text-gray-700 text-sm">{order.special_instructions}</Text>
          </View>
        )}

        {/* Order Items */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Order Items</Text>
          {order.order_items.map((item, index) => (
            <View
              key={item.id}
              className={`flex-row justify-between py-2 ${
                index < order.order_items.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <View className="flex-1">
                <Text className="text-gray-900 text-base font-medium">
                  {item.quantity} × {item.item_name}
                </Text>
                {item.item_description && (
                  <Text className="text-gray-500 text-xs mt-0.5">{item.item_description}</Text>
                )}
              </View>
              <Text className="text-gray-900 text-base font-semibold ml-2">
                {formatPrice(item.subtotal_cents)}
              </Text>
            </View>
          ))}
        </View>

        {/* Payment Summary */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Payment Summary</Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600 text-base">Subtotal</Text>
            <Text className="text-gray-900 text-base font-semibold">
              {formatPrice(order.subtotal_cents)}
            </Text>
          </View>

          {order.surcharge_cents > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600 text-base">Small order surcharge</Text>
              <Text className="text-gray-900 text-base font-semibold">
                {formatPrice(order.surcharge_cents)}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600 text-base">Delivery fee</Text>
            <Text className="text-gray-900 text-base font-semibold">
              {formatPrice(order.delivery_fee_cents)}
            </Text>
          </View>

          <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
            <Text className="text-gray-900 text-lg font-bold">Total</Text>
            <Text className="text-gray-900 text-lg font-bold">
              {formatPrice(order.total_cents)}
            </Text>
          </View>

          <View className="mt-3 pt-3 border-t border-gray-200">
            <View className="flex-row justify-between">
              <Text className="text-gray-600 text-base">Payment method</Text>
              <Text className="text-gray-900 text-base font-semibold capitalize">
                {order.payment_method}
              </Text>
            </View>
          </View>
        </View>

        {/* Cancel Order Button */}
        {statusDisplay.allowCancel && !cancelOrderMutation.isLoading && (
          <TouchableOpacity
            onPress={handleCancelOrder}
            className="bg-red-50 border border-red-200 rounded-xl p-4 items-center mb-4"
            activeOpacity={0.7}
          >
            <Text className="text-red-600 font-semibold">Cancel Order</Text>
          </TouchableOpacity>
        )}

        {cancelOrderMutation.isLoading && (
          <View className="bg-gray-50 rounded-xl p-4 items-center mb-4">
            <ActivityIndicator size="small" color="#EF4444" />
            <Text className="text-gray-600 text-sm mt-2">Cancelling order...</Text>
          </View>
        )}

        {/* Cancellation Info */}
        {order.status === 'cancelled' && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-900 font-semibold mb-1">Order Cancelled</Text>
            {order.cancellation_reason && (
              <Text className="text-red-700 text-sm">
                Reason: {order.cancellation_reason}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getStatusIcon(status: string, color: string): React.ReactNode {
  const secondaryColor = withAlpha(color, '20');

  switch (status) {
    case 'pending':
      return <OrderPendingIcon size={72} primaryColor={color} secondaryColor={secondaryColor} />;
    case 'confirmed':
      return <OrderConfirmedIcon size={72} primaryColor={color} secondaryColor={secondaryColor} />;
    case 'out_for_delivery':
      return (
        <OrderOutForDeliveryIcon size={72} primaryColor={color} secondaryColor={secondaryColor} />
      );
    case 'delivered':
      return <OrderDeliveredIcon size={72} primaryColor={color} secondaryColor={secondaryColor} />;
    case 'cancelled':
      return <OrderCancelledIcon size={72} primaryColor={color} secondaryColor={secondaryColor} />;
    default:
      return <OrderPendingIcon size={72} primaryColor={color} secondaryColor={secondaryColor} />;
  }
}

function withAlpha(color: string, alphaHex: string): string {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  return color;
}

