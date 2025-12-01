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
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import LinearGradient from 'react-native-linear-gradient';
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
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OrderStatus'>;

export default function OrderStatusScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();

  const { data: order, isLoading, refetch } = useOrder(orderId);
  const cancelOrderMutation = useCancelOrder();

  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const handleCancelOrder = () => {
    Alert.alert(
      t('orders.cancelConfirmationTitle'),
      t('orders.cancelConfirmationMsg'),
      [
        { text: t('orders.no'), style: 'cancel' },
        {
          text: t('orders.yesCancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelOrderMutation.mutateAsync({
                orderId,
                reason: 'Cancelled by customer',
              });
              if (result.success) {
                // Refetch order to get updated status immediately
                await refetch();
                Alert.alert(t('orders.cancelledTitle'), t('orders.cancelSuccess'));
              } else {
                Alert.alert(t('profile.error'), result.message || t('orders.cancelFailed'));
              }
            } catch (error) {
              console.error('Error cancelling order:', error);
              Alert.alert(t('profile.error'), t('orders.cancelFailed'));
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
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center" edges={[]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            zIndex: 30,
          }}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["#2563eb", "#1d4ed8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">{t('orders.loadingOrder')}</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8" edges={[]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            zIndex: 30,
          }}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["#2563eb", "#1d4ed8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>
        <Text className="text-6xl mb-4">📦</Text>
        <Text className="text-gray-900 text-lg font-semibold mb-2">{t('orders.notFound')}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-4 bg-blue-600 px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">{t('cart.goBack')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusDisplay = getOrderStatusDisplay(order.status);

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Gradient overlay behind notch/status bar */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          zIndex: 30,
        }}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Header */}
      <SafeAreaView edges={[]} className="bg-white border-b border-gray-200" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            activeOpacity={0.7}
          >
            <BackIcon size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-gray-900 text-lg font-bold">{t('orders.statusTitle')}</Text>
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
            {t(`orders.status.${order.status}`)}
          </Text>
          <Text className="text-gray-600 text-center mb-4">
            {t(`orders.statusDescription.${order.status}`)}
          </Text>

        </View>

        {/* Delivery Runner Info (only when out for delivery) */}
        {order.delivery_runner && order.status === 'out_for_delivery' && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <DeliveryRunnerIcon size={20} color="#111827" />
              <Text className="text-lg font-bold text-gray-900 ml-2">{t('orders.deliveryRunner')}</Text>
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
                <Text className="text-white font-semibold">{t('orders.call')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Shop Info */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('orders.shopDetails')}</Text>
          <Text className="text-gray-900 text-base font-semibold">{order.shop.name}</Text>
          <Text className="text-gray-600 text-sm mt-1">{order.shop.shop_type}</Text>
          <Text className="text-gray-600 text-sm mt-1">{order.shop.address}</Text>
        </View>

        {/* Delivery Address */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('checkout.deliveryAddress')}</Text>
          <Text className="text-gray-900 text-base">
            {order.delivery_address.street_address}
          </Text>
          <Text className="text-gray-600 text-sm mt-1">
            {order.delivery_address.city}
            {order.delivery_address.region && `, ${order.delivery_address.region}`}
          </Text>
          {order.delivery_address.landmark && (
            <View className="mt-2">
              <Text className="text-xs text-gray-500">{t('checkout.landmark')}</Text>
              <Text className="text-gray-700 text-sm">{order.delivery_address.landmark}</Text>
            </View>
          )}
        </View>

        {/* Special Instructions */}
        {order.special_instructions && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('orders.specialInstructions')}</Text>
            <Text className="text-gray-700 text-sm">{order.special_instructions}</Text>
          </View>
        )}

        {/* Order Items */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('orders.orderItems')}</Text>
          {order.order_items.map((item, index) => (
            <View
              key={item.id}
              className={`flex-row justify-between py-2 ${index < order.order_items.length - 1 ? 'border-b border-gray-100' : ''
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
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('orders.paymentSummary')}</Text>

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600 text-base">{t('cart.subtotal')}</Text>
            <Text className="text-gray-900 text-base font-semibold">
              {formatPrice(order.subtotal_cents)}
            </Text>
          </View>

          {order.surcharge_cents > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600 text-base">{t('cart.surcharge')}</Text>
              <Text className="text-gray-900 text-base font-semibold">
                {formatPrice(order.surcharge_cents)}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600 text-base">{t('cart.delivery')}</Text>
            <Text className="text-gray-900 text-base font-semibold">
              {formatPrice(order.delivery_fee_cents)}
            </Text>
          </View>

          <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
            <Text className="text-gray-900 text-lg font-bold">{t('cart.total')}</Text>
            <Text className="text-gray-900 text-lg font-bold">
              {formatPrice(order.total_cents)}
            </Text>
          </View>

          <View className="mt-3 pt-3 border-t border-gray-200">
            <View className="flex-row justify-between">
              <Text className="text-gray-600 text-base">{t('orders.paymentMethod')}</Text>
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
            <Text className="text-red-600 font-semibold">{t('orders.cancelOrder')}</Text>
          </TouchableOpacity>
        )}

        {cancelOrderMutation.isLoading && (
          <View className="bg-gray-50 rounded-xl p-4 items-center mb-4">
            <ActivityIndicator size="small" color="#EF4444" />
            <Text className="text-gray-600 text-sm mt-2">{t('orders.cancelling')}</Text>
          </View>
        )}

        {/* Cancellation Info */}
        {order.status === 'cancelled' && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-900 font-semibold mb-1">{t('orders.cancelledTitle')}</Text>
            {order.cancellation_reason && (
              <Text className="text-red-700 text-sm">
                {t('orders.cancellationReason')}: {order.cancellation_reason}
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

