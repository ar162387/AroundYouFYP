import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import type { MerchantShop } from '../../../../services/merchant/shopService';
import type { RootStackParamList } from '../../../../navigation/types';
import {
  useShopOrders,
  useGroupedOrders,
} from '../../../../hooks/merchant/useOrders';
import {
  OrderWithAll,
  OrderTimeFilter,
  getOrderStatusDisplay,
  formatPrice,
  formatDuration,
} from '../../../../types/orders';
import LocationMarkerIcon from '../../../../icons/LocationMarkerIcon';

type OrdersSectionProps = {
  shop: MerchantShop;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OrdersSection({ shop }: OrdersSectionProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const filterScrollRef = useRef<ScrollView>(null);

  const {
    data: orders,
    isLoading,
    refetch,
    isFetching,
  } = useShopOrders(shop.id);
  const typedOrders = orders as OrderWithAll[] | undefined;

  const [selectedTimeFilter, setSelectedTimeFilter] =
    useState<OrderTimeFilter>('today');

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleOpenOrderDetail = useCallback(
    (order: OrderWithAll) => {
      navigation.navigate('MerchantOrder', {
        shopId: shop.id,
        orderId: order.id,
      });
    },
    [navigation, shop.id],
  );

  const filteredOrders = useMemo(() => {
    if (!typedOrders || !Array.isArray(typedOrders)) return [];
    return getFilteredOrdersByTime(typedOrders, selectedTimeFilter);
  }, [typedOrders, selectedTimeFilter]);

  const groupedFilteredOrders = useGroupedOrders(filteredOrders);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">{t('merchant.orders.loading')}</Text>
      </View>
    );
  }

  if (!typedOrders || !Array.isArray(typedOrders) || typedOrders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-6xl mb-4">📦</Text>
        <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">
          {t('merchant.orders.noOrders')}
        </Text>
        <Text className="text-gray-500 text-center">
          {t('merchant.orders.noOrdersDesc')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="bg-white border-b border-gray-200">
        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
          // Prevent parent horizontal scroll when scrolling filter chips
          directionalLockEnabled={true}
          alwaysBounceHorizontal={true}
          alwaysBounceVertical={false}
        >
          {(['today', 'yesterday', '7days', '30days', 'all'] as OrderTimeFilter[]).map(
            (filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setSelectedTimeFilter(filter)}
                className={`mr-3 px-4 py-2 rounded-full ${
                  selectedTimeFilter === filter ? 'bg-blue-600' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    selectedTimeFilter === filter ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {getFilterLabel(filter, t)}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} />
        }
      >
        {filteredOrders.length === 0 ? (
          <View className="py-8 items-center">
            <Text className="text-gray-500 text-center">
              {t('merchant.orders.noOrdersForPeriod')}
            </Text>
          </View>
        ) : selectedTimeFilter === 'today' && groupedFilteredOrders ? (
          groupedFilteredOrders.today.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => handleOpenOrderDetail(order)}
            />
          ))
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => handleOpenOrderDetail(order)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

interface OrderCardProps {
  order: OrderWithAll;
  onPress: () => void;
}

function OrderCard({ order, onPress }: OrderCardProps) {
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

  const [tick, setTick] = useState(0);

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

  React.useEffect(() => {
    if (order.status !== 'delivered' && order.status !== 'cancelled') {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [order.status]);

  const itemsPreview = order.order_items.slice(0, 5);
  const remainingCount = order.order_items.length - 5;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-4 border border-gray-200"
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
            <LocationMarkerIcon size={18} color="#1D4ED8" innerColor="#FFFFFF" accentColor="rgba(255,255,255,0.25)" />
          </View>
          <Text className="text-gray-700 text-sm flex-1">
            {order.delivery_address.street_address.split(',').slice(0, 2).join(',')}
            {order.delivery_address.landmark && ` (${order.delivery_address.landmark})`}
          </Text>
        </View>
      </View>

      <View className="mb-3">
        {itemsPreview.map((item) => (
          <Text key={item.id} className="text-gray-500 text-xs">
            {item.quantity} × {item.item_name}
          </Text>
        ))}
        {remainingCount > 0 && (
          <Text className="text-gray-400 text-xs">{t('merchant.orders.moreItems', { count: remainingCount })}</Text>
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

function getFilterLabel(filter: OrderTimeFilter, t: (key: string) => string): string {
  switch (filter) {
    case 'today':
      return t('merchant.orders.filters.today');
    case 'yesterday':
      return t('merchant.orders.filters.yesterday');
    case '7days':
      return t('merchant.orders.filters.last7Days');
    case '30days':
      return t('merchant.orders.filters.last30Days');
    case 'all':
      return t('merchant.orders.filters.allTime');
    default:
      return filter;
  }
}

function getFilteredOrdersByTime(
  orders: OrderWithAll[],
  filter: OrderTimeFilter,
): OrderWithAll[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return orders.filter((o) => new Date(o.placed_at) >= todayStart);
    case 'yesterday': {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      return orders.filter(
        (o) =>
          new Date(o.placed_at) >= yesterdayStart &&
          new Date(o.placed_at) < todayStart,
      );
    }
    case '7days': {
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return orders.filter((o) => new Date(o.placed_at) >= sevenDaysAgo);
    }
    case '30days': {
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return orders.filter((o) => new Date(o.placed_at) >= thirtyDaysAgo);
    }
    case 'all':
    default:
      return orders;
  }
}