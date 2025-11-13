import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useUserOrders } from '../../hooks/consumer/useOrders';
import { OrderWithAll, getOrderStatusDisplay, formatPrice, formatDuration } from '../../types/orders';
import BackIcon from '../../icons/BackIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OrdersListScreen() {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, refetch, isRefetching } = useUserOrders();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">Loading orders...</Text>
      </SafeAreaView>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
              activeOpacity={0.7}
            >
              <BackIcon size={20} color="#374151" />
            </TouchableOpacity>
            <Text className="text-gray-900 text-lg font-bold">My Orders</Text>
          </View>
        </View>

        {/* Empty State */}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">📦</Text>
          <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">
            No orders yet
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            Start shopping to place your first order
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="bg-blue-600 px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Browse Shops</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <SafeAreaView edges={['top']} className="bg-white border-b border-gray-200">
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            activeOpacity={0.7}
          >
            <BackIcon size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-gray-900 text-lg font-bold">My Orders</Text>
            <Text className="text-gray-500 text-sm">{orders.length} total</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} navigation={navigation} />
        ))}
      </ScrollView>
    </View>
  );
}

function OrderCard({ order, navigation }: { order: OrderWithAll; navigation: Nav }) {
  const statusDisplay = getOrderStatusDisplay(order.status);
  const placedDate = new Date(order.placed_at);
  const now = new Date();
  const isToday = placedDate.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === placedDate.toDateString();

  const dateLabel = isToday
    ? 'Today'
    : isYesterday
    ? 'Yesterday'
    : placedDate.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });

  const timeLabel = placedDate.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Get order items preview (max 5 items)
  const itemsPreview = order.order_items.slice(0, 5);
  const remainingCount = order.order_items.length - 5;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('OrderStatus', { orderId: order.id })}
      className="bg-white rounded-xl p-4 mb-4 border border-gray-200"
      activeOpacity={0.7}
    >
      {/* Order Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-gray-900 text-base font-bold mb-1">{order.shop.name}</Text>
          <Text className="text-gray-500 text-xs">{order.order_number}</Text>
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

      {/* Date & Time */}
      <View className="flex-row items-center mb-3">
        <Text className="text-gray-600 text-sm">
          {dateLabel} at {timeLabel}
        </Text>
      </View>

      {/* Delivery Address Preview */}
      {order.customer_name && (
        <View className="mb-2">
          <Text className="text-gray-700 text-sm">
            <Text className="font-medium">{order.customer_name}</Text>
            {order.customer_email && (
              <Text className="text-gray-500"> • {order.customer_email}</Text>
            )}
          </Text>
        </View>
      )}

      <View className="mb-3">
        <Text className="text-gray-700 text-sm">
          📍 {order.delivery_address.street_address}
          {order.delivery_address.landmark && ` (${order.delivery_address.landmark})`}
        </Text>
      </View>

      {/* Items Preview */}
      <View className="mb-3 space-y-1">
        {itemsPreview.map((item) => (
          <Text key={item.id} className="text-gray-500 text-xs">
            {item.quantity} × {item.item_name}
          </Text>
        ))}
        {remainingCount > 0 && (
          <Text className="text-gray-400 text-xs">+{remainingCount} more items</Text>
        )}
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
        <Text className="text-gray-900 text-base font-bold">
          {formatPrice(order.total_cents)}
        </Text>
        <Text className="text-blue-600 text-sm font-semibold">View Details →</Text>
      </View>

      {/* Delivery Runner Info (if applicable) */}
      {order.delivery_runner && order.status === 'out_for_delivery' && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2">
              <Text className="text-sm">🚚</Text>
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-sm font-semibold">
                {order.delivery_runner.name}
              </Text>
              <Text className="text-gray-500 text-xs">On the way</Text>
            </View>
          </View>
        </View>
      )}

      {/* Timings (for delivered orders) */}
      {order.status === 'delivered' && order.delivery_time_seconds && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-gray-500 text-xs">
            Total delivery time: {formatDuration(
              (order.confirmation_time_seconds || 0) +
              (order.preparation_time_seconds || 0) +
              (order.delivery_time_seconds || 0)
            )}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

