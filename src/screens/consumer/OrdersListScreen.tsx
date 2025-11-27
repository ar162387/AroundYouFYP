import React, { useState, useEffect } from 'react';
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
import { getReviewByOrder, getReview } from '../../services/consumer/reviewService';
import BackIcon from '../../icons/BackIcon';
import LocationMarkerIcon from '../../icons/LocationMarkerIcon';
import StarIcon from '../../icons/StarIcon';
import ReviewBottomSheet from '../../components/consumer/ReviewBottomSheet';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OrdersListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, refetch, isFetching } = useUserOrders();
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  const [reviewSheetShop, setReviewSheetShop] = useState<{ id: string; name: string; orderId?: string } | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">{t('orders.loading')}</Text>
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
            <Text className="text-gray-900 text-lg font-bold">{t('orders.title')}</Text>
          </View>
        </View>

        {/* Empty State */}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">📦</Text>
          <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">
            {t('orders.noOrders')}
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            {t('orders.startShopping')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            className="bg-blue-600 px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">{t('orders.browseShops')}</Text>
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
            <Text className="text-gray-900 text-lg font-bold">{t('orders.title')}</Text>
            <Text className="text-gray-500 text-sm">{orders.length} {t('orders.total')}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} />
        }
      >
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            navigation={navigation}
            onReviewPress={(shopId, shopName, orderId) => {
              setReviewSheetShop({ id: shopId, name: shopName, orderId });
              setReviewSheetVisible(true);
            }}
            onReviewSubmitted={() => {
              setReviewSheetVisible(false);
              setReviewSheetShop(null);
              refetch();
            }}
          />
        ))}
      </ScrollView>

      {/* Review Bottom Sheet */}
      {reviewSheetShop && (
        <ReviewBottomSheet
          visible={reviewSheetVisible}
          onClose={() => {
            setReviewSheetVisible(false);
            setReviewSheetShop(null);
          }}
          shopId={reviewSheetShop.id}
          shopName={reviewSheetShop.name}
          orderId={reviewSheetShop.orderId}
          onReviewSubmitted={() => {
            setReviewSheetVisible(false);
            setReviewSheetShop(null);
            refetch();
          }}
        />
      )}
    </View>
  );
}

interface OrderCardProps {
  order: OrderWithAll;
  navigation: Nav;
  onReviewPress: (shopId: string, shopName: string, orderId: string) => void;
  onReviewSubmitted: () => void;
}

function OrderCard({ order, navigation, onReviewPress, onReviewSubmitted }: OrderCardProps) {
  const { t } = useTranslation();
  const statusDisplay = getOrderStatusDisplay(order.status);
  const placedDate = new Date(order.placed_at);
  const now = new Date();
  const isToday = placedDate.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === placedDate.toDateString();

  const dateLabel = isToday
    ? t('orders.today')
    : isYesterday
      ? t('orders.yesterday')
      : placedDate.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });

  const timeLabel = placedDate.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Get order items preview (max 5 items)
  const itemsPreview = order.order_items.slice(0, 5);
  const remainingCount = order.order_items.length - 5;

  // Check if this order has been reviewed
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [isCheckingReview, setIsCheckingReview] = useState(true);

  useEffect(() => {
    const checkReview = async () => {
      if (order.status !== 'delivered') {
        setReviewRating(null);
        setIsCheckingReview(false);
        return;
      }

      setIsCheckingReview(true);
      // First try to get review by order_id, then by shop_id
      const { data: orderReview } = await getReviewByOrder(order.id);
      if (orderReview) {
        setReviewRating(orderReview.rating);
      } else {
        const { data: shopReview } = await getReview(order.shop_id);
        if (shopReview) {
          setReviewRating(shopReview.rating);
        } else {
          setReviewRating(null);
        }
      }
      setIsCheckingReview(false);
    };

    checkReview();
  }, [order.id, order.shop_id, order.status]);

  const handleStarsPress = (e: any) => {
    e.stopPropagation();
    if (order.status === 'delivered') {
      onReviewPress(order.shop_id, order.shop.name, order.id);
    }
  };

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
        <View className="flex-row items-start">
          <View className="mr-2 mt-0.5">
            <LocationMarkerIcon size={18} color="#1D4ED8" innerColor="#FFFFFF" accentColor="rgba(255,255,255,0.25)" />
          </View>
          <Text className="text-gray-700 text-sm flex-1">
            {order.delivery_address.street_address}
            {order.delivery_address.landmark && ` (${order.delivery_address.landmark})`}
          </Text>
        </View>
      </View>

      {/* Items Preview */}
      <View className="mb-3 space-y-1">
        {itemsPreview.map((item) => (
          <Text key={item.id} className="text-gray-500 text-xs">
            {item.quantity} × {item.item_name}
          </Text>
        ))}
        {remainingCount > 0 && (
          <Text className="text-gray-400 text-xs">+{remainingCount} {t('cart.items')}</Text>
        )}
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
        <Text className="text-gray-900 text-base font-bold">
          {formatPrice(order.total_cents)}
        </Text>
        <Text className="text-blue-600 text-sm font-semibold">{t('orders.viewDetails')} →</Text>
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
              <Text className="text-gray-500 text-xs">{t('orders.onTheWay')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Timings (for delivered orders) */}
      {order.status === 'delivered' && order.delivery_time_seconds && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-gray-500 text-xs">
            {t('orders.totalDeliveryTime')}: {formatDuration(
              (order.confirmation_time_seconds || 0) +
              (order.preparation_time_seconds || 0) +
              (order.delivery_time_seconds || 0)
            )}
          </Text>
        </View>
      )}

      {/* Rating Stars (for delivered orders) */}
      {order.status === 'delivered' && !isCheckingReview && (
        <TouchableOpacity
          onPress={handleStarsPress}
          className="mt-3 pt-3 border-t border-gray-100"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-700 text-sm font-medium mr-3">{t('orders.rateOrder')}</Text>
            <View className="flex-row items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <View key={star} className="mx-0.5">
                  <StarIcon
                    size={20}
                    color="#FCD34D"
                    filled={reviewRating !== null ? star <= reviewRating : false}
                  />
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

