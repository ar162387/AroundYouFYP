import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';

import { useAuth } from '../../context/AuthContext';
import { useAllMerchantOrders } from '../../hooks/merchant/useOrders';
import type { RootStackParamList } from '../../navigation/types';
import {
  OrderWithAll,
  getOrderStatusDisplay,
  formatPrice,
  formatDuration,
} from '../../types/orders';
import LocationMarkerIcon from '../../icons/LocationMarkerIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MerchantOrdersScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const {
    data: orders,
    isLoading,
    refetch,
    isFetching,
  } = useAllMerchantOrders(user?.id);

  const [tick, setTick] = useState(0);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Filter active orders (exclude delivered and cancelled)
  const activeOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    return orders.filter(
      (order) => order.status !== 'delivered' && order.status !== 'cancelled'
    );
  }, [orders]);

  // Group orders by shop name
  const ordersByShop = useMemo(() => {
    const grouped: Record<string, OrderWithAll[]> = {};
    activeOrders.forEach((order) => {
      const shopName = order.shop?.name || 'Unknown Shop';
      if (!grouped[shopName]) {
        grouped[shopName] = [];
      }
      grouped[shopName].push(order);
    });

    // Sort orders within each shop by placed_at (newest first)
    Object.keys(grouped).forEach((shopName) => {
      grouped[shopName].sort(
        (a, b) =>
          new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
      );
    });

    return grouped;
  }, [activeOrders]);

  // Update tick every second for live timers
  React.useEffect(() => {
    if (activeOrders.length > 0) {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [activeOrders.length]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleOpenOrderDetail = useCallback(
    (order: OrderWithAll) => {
      navigation.navigate('MerchantOrder', {
        shopId: order.shop_id,
        orderId: order.id,
      });
    },
    [navigation]
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
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
        <Text className="text-gray-600 mt-4">{t('merchant.orders.loading')}</Text>
      </View>
    );
  }

  if (activeOrders.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
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
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} />
          }
        >
          <View className="px-4 mt-6">
            <Text className="text-2xl font-bold text-gray-900 mb-4">
              {t('merchant.orders.title')}
            </Text>
            <View className="bg-white rounded-xl p-6 items-center">
              <Text className="text-6xl mb-4">📦</Text>
              <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">
                {t('merchant.orders.noActiveOrders')}
              </Text>
              <Text className="text-gray-500 text-center">
                {t('merchant.orders.noActiveOrdersDesc')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  const shopNames = Object.keys(ordersByShop).sort();

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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} />
        }
      >
        <View className="px-4 mt-6 mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            {t('merchant.orders.title')}
          </Text>
        </View>

        {shopNames.map((shopName) => (
          <View key={shopName} className="mb-6">
            <View className="px-4 mb-3">
              <Text className="text-lg font-semibold text-gray-900">
                {shopName}
              </Text>
              <Text className="text-sm text-gray-500">
                {ordersByShop[shopName].length}{' '}
                {ordersByShop[shopName].length === 1
                  ? t('merchant.orders.order')
                  : t('merchant.orders.orders')}
              </Text>
            </View>

            {ordersByShop[shopName].map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => handleOpenOrderDetail(order)}
                tick={tick}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface OrderCardProps {
  order: OrderWithAll;
  onPress: () => void;
  tick: number;
}

function OrderCard({ order, onPress, tick }: OrderCardProps) {
  const { t } = useTranslation();
  const statusDisplay = useMemo(() => {
    const baseDisplay = getOrderStatusDisplay(order.status);
    // Override title with translation
    const statusKey = `merchant.orders.status.${order.status}`;
    return {
      ...baseDisplay,
      title: t(statusKey, { defaultValue: baseDisplay.title }),
    };
  }, [order.status, t]);
  const placedDate = new Date(order.placed_at);
  const timeLabel = placedDate.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const elapsedSeconds = useMemo(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') return 0;

    let startTime: Date;
    if (order.status === 'pending') {
      startTime = new Date(order.placed_at);
    } else if (order.status === 'confirmed') {
      startTime = new Date(order.confirmed_at!);
    } else if (order.status === 'out_for_delivery') {
      startTime = new Date(order.out_for_delivery_at!);
    } else {
      return 0;
    }

    return Math.floor((Date.now() - startTime.getTime()) / 1000);
  }, [order, tick]);

  const itemsPreview = order.order_items.slice(0, 5);
  const remainingCount = order.order_items.length - 5;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white mx-4 rounded-xl p-4 mb-3 border border-gray-200"
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-gray-900 text-base font-bold mb-1">
            {order.order_number}
          </Text>
          <Text className="text-gray-500 text-xs">{timeLabel}</Text>
        </View>
        <View
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: `${statusDisplay.color}20` }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: statusDisplay.color }}
          >
            {statusDisplay.title}
          </Text>
        </View>
      </View>

      {elapsedSeconds > 0 && (
        <View className="mb-3">
          <Text className="text-gray-700 text-sm font-semibold">
            ⏱️ {formatDuration(elapsedSeconds)}
            {order.status === 'out_for_delivery' && order.delivery_runner?.name
              ? ` • ${order.delivery_runner.name}`
              : ''}
          </Text>
        </View>
      )}

      {order.customer_name && (
        <View className="mb-2">
          <Text className="text-gray-900 text-sm font-medium">
            {order.customer_name}
          </Text>
          {order.customer_email && (
            <Text className="text-gray-500 text-xs">
              {order.customer_email}
            </Text>
          )}
        </View>
      )}

      <View className="mb-3">
        <View className="flex-row items-start">
          <View className="mr-2 mt-0.5">
            <LocationMarkerIcon
              size={18}
              color="#1D4ED8"
              innerColor="#FFFFFF"
              accentColor="rgba(255,255,255,0.25)"
            />
          </View>
          <Text className="text-gray-700 text-sm flex-1">
            {order.delivery_address.street_address.split(',').slice(0, 2).join(',')}
            {order.delivery_address.landmark &&
              ` (${order.delivery_address.landmark})`}
          </Text>
        </View>
      </View>

      <View className="mb-3">
        {itemsPreview.map((item: any) => (
          <Text key={item.id} className="text-gray-500 text-xs">
            {item.quantity} × {item.item_name}
          </Text>
        ))}
        {remainingCount > 0 && (
          <Text className="text-gray-400 text-xs">
            {t('merchant.orders.moreItems', { count: remainingCount })}
          </Text>
        )}
      </View>

      <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
        <Text className="text-gray-900 text-base font-bold">
          {formatPrice(order.total_cents)}
        </Text>
        <Text className="text-blue-600 text-sm font-semibold">
          {t('merchant.orders.viewDetails')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

