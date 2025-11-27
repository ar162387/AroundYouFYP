import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useActiveOrder, useOrderTimer } from '../../hooks/consumer/useOrders';
import { getOrderStatusDisplay } from '../../types/orders';
import {
  OrderPendingIcon,
  OrderConfirmedIcon,
  OrderOutForDeliveryIcon,
  OrderDeliveredIcon,
  OrderCancelledIcon,
} from '../../icons/OrderStatusIcons';
import DeliveryRunnerIcon from '../../icons/DeliveryRunnerIcon';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ActiveOrderBanner() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const navigation = useNavigation<Nav>();
  const { data: order, isLoading } = useActiveOrder();
  const timerState = useOrderTimer(order);

  // Animated value for pulsing effect
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (order && timerState.isActive) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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

      return () => {
        animation.stop();
      };
    }

    pulseAnim.setValue(1);
  }, [order, timerState.isActive, pulseAnim]);

  // Don't show banner if no active order, loading, or order is terminal
  if (isLoading || !order || order.status === 'delivered' || order.status === 'cancelled') {
    return null;
  }

  const statusDisplay = getOrderStatusDisplay(order.status);

  return (
    <Animated.View
      style={{
        transform: [{ scale: pulseAnim }],
      }}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate('OrderStatus', { orderId: order.id })}
        className="mx-4 mb-2 rounded-xl overflow-hidden"
        style={{ backgroundColor: statusDisplay.color }}
        activeOpacity={0.9}
      >
        <View className="px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-12 h-12 bg-white/15 rounded-full items-center justify-center mr-3">
                {renderStatusIcon(order.status)}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text className="text-white text-sm font-bold mr-2">{t(`orders.status.${order.status}`)}</Text>
                  {/* Timer removed per request */}
                </View>

                <Text className="text-white/90 text-xs" numberOfLines={1}>
                  {order.shop.name}
                </Text>

                {/* Show runner info if out for delivery */}
                {order.delivery_runner && order.status === 'out_for_delivery' && (
                  <View className="flex-row items-center mt-1">
                    <DeliveryRunnerIcon size={12} color="#FFFFFF" />
                    <Text className="text-white/90 text-xs ml-1">
                      {order.delivery_runner.name} • {order.delivery_runner.phone_number}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Arrow */}
            <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
              <Text className="text-white text-lg">{isRTL ? '←' : '→'}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
            <View
              className="h-full bg-white rounded-full"
              style={{
                width: `${getProgressPercentage(order.status)}%`,
              }}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function renderStatusIcon(status: string): React.ReactNode {
  const primary = '#FFFFFF';
  const secondary = '#FFFFFF33';

  switch (status) {
    case 'pending':
      return <OrderPendingIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
    case 'confirmed':
      return <OrderConfirmedIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
    case 'out_for_delivery':
      return <OrderOutForDeliveryIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
    case 'delivered':
      return <OrderDeliveredIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
    case 'cancelled':
      return <OrderCancelledIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
    default:
      return <OrderPendingIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
  }
}

function getProgressPercentage(status: string): number {
  switch (status) {
    case 'pending':
      return 25;
    case 'confirmed':
      return 50;
    case 'out_for_delivery':
      return 75;
    case 'delivered':
      return 100;
    default:
      return 0;
  }
}

