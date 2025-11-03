import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { MerchantShop } from '../../services/merchant/shopService';

interface MerchantShopCardProps {
  shop: MerchantShop;
  onPress?: () => void;
}

// Custom icons for stats
const OrdersIcon = () => (
  <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center">
    <Text className="text-green-600 text-base">📦</Text>
  </View>
);

const CancelledIcon = () => (
  <View className="w-8 h-8 bg-red-100 rounded-full items-center justify-center">
    <Text className="text-red-600 text-base">❌</Text>
  </View>
);

const RevenueIcon = () => (
  <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center">
    <Text className="text-blue-600 text-base">💰</Text>
  </View>
);

export default function MerchantShopCard({ shop, onPress }: MerchantShopCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl mb-4 overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      }}
      activeOpacity={0.7}
    >
      {/* Shop Image and Name */}
      <View className="flex-row">
        {shop.image_url ? (
          <Image
            source={{ uri: shop.image_url }}
            className="w-24 h-24 rounded-l-2xl"
            resizeMode="cover"
          />
        ) : (
          <View className="w-24 h-24 bg-gray-200 rounded-l-2xl items-center justify-center">
            <Text className="text-4xl">🏪</Text>
          </View>
        )}
        
        <View className="flex-1 p-4 justify-center">
          <Text className="text-lg font-bold text-gray-900 mb-1" numberOfLines={2}>
            {shop.name}
          </Text>
          <Text className="text-sm text-gray-500" numberOfLines={1}>
            {shop.shop_type}
          </Text>
        </View>
      </View>

      {/* Stats Section */}
      <View className="px-4 pb-4 pt-2 border-t border-gray-100">
        <View className="flex-row justify-between items-center">
          {/* Orders Today */}
          <View className="flex-row items-center flex-1">
            <OrdersIcon />
            <View className="ml-2 flex-1">
              <Text className="text-xs text-gray-500">Orders Today</Text>
              <Text className="text-base font-bold text-gray-900">{shop.orders_today}</Text>
            </View>
          </View>

          {/* Cancelled Today */}
          <View className="flex-row items-center flex-1 ml-4">
            <CancelledIcon />
            <View className="ml-2 flex-1">
              <Text className="text-xs text-gray-500">Cancelled</Text>
              <Text className="text-base font-bold text-gray-900">{shop.orders_cancelled_today}</Text>
            </View>
          </View>

          {/* Revenue Today */}
          <View className="flex-row items-center flex-1 ml-4">
            <RevenueIcon />
            <View className="ml-2 flex-1">
              <Text className="text-xs text-gray-500">Revenue</Text>
              <Text className="text-base font-bold text-gray-900">Rs {shop.revenue_today.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

