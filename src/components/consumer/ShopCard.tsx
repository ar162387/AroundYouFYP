
import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import type { Shop } from '../../services/supabase';
import DeliveryRunnerIcon from '../../icons/DeliveryRunnerIcon';
import MoneyIcon from '../../icons/MoneyIcon';
import { getShopReviewStats } from '../../services/consumer/reviewService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_IMAGE_HEIGHT = Math.round((SCREEN_WIDTH - 32) * 9 / 16 * 0.75); // 75% of original 16:9 height

interface ShopCardProps {
  shop: Shop;
  onPress?: () => void;
}

export default function ShopCard({ shop, onPress }: ShopCardProps) {
  const isClosed = !shop.is_open;
  const [averageRating, setAverageRating] = useState<number | null>(null);

  useEffect(() => {
    const fetchRating = async () => {
      const { data } = await getShopReviewStats(shop.id);
      if (data) {
        setAverageRating(data.average_rating);
      }
    };
    fetchRating();
  }, [shop.id]);

  // Use fetched rating or fall back to shop.rating (which might be 0)
  const displayRating = averageRating !== null ? averageRating : (shop.rating > 0 ? shop.rating : null);
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-xl shadow-md mb-2 overflow-hidden ${isClosed ? 'bg-gray-100' : 'bg-white'}`}
      activeOpacity={0.7}
    >
      {/* Shop Image - Smaller height while maintaining 16:9 aspect ratio */}
      {shop.image_url ? (
        <View className="w-full bg-gray-100 overflow-hidden" style={{ height: CARD_IMAGE_HEIGHT }}>
          <Image
            source={{ uri: shop.image_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>
      ) : (
        <View className="w-full bg-gray-200 items-center justify-center" style={{ height: CARD_IMAGE_HEIGHT }}>
          <Text className="text-gray-400 text-sm">No Image</Text>
        </View>
      )}

      {/* Shop Info - Reduced padding */}
      <View className="p-3">
        {/* Shop Name and Rating */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-base font-extrabold text-gray-900 flex-1" numberOfLines={1}>
            {shop.name}
          </Text>
          <View className="flex-row items-center ml-2">
            <Text className="text-yellow-500 text-sm mr-1">★</Text>
            <Text className="text-gray-700 text-sm">
              {displayRating !== null ? displayRating.toFixed(1) : 'New'}
            </Text>
            {shop.orders !== undefined && shop.orders > 0 && (
              <Text className="text-gray-600 text-sm ml-1">
                ({shop.orders.toLocaleString()})
              </Text>
            )}
          </View>
        </View>

        {/* Shop Type, Delivery Fee, and Minimum Order - Light gray text with icons */}
        <View className="flex-row items-center flex-wrap gap-x-3 gap-y-1.5 mb-2">
          {/* Shop Type */}
          {shop.shop_type && (
            <View className="flex-row items-center">
              <Text className="text-gray-500 text-xs">
                {shop.shop_type}
              </Text>
            </View>
          )}

          {/* Delivery Fee */}
          <View className="flex-row items-center">
            <DeliveryRunnerIcon size={12} color="#9CA3AF" />
            <Text className="text-gray-500 text-xs ml-1">
              {shop.delivery_fee > 0 ? `Rs ${Math.round(shop.delivery_fee)}` : 'Free'}
            </Text>
          </View>

          {/* Minimum Order Value */}
          {shop.minimumOrderValue !== undefined && shop.minimumOrderValue > 0 && (
            <View className="flex-row items-center">
              <MoneyIcon size={12} color="#9CA3AF" />
              <Text className="text-gray-500 text-xs ml-1">
                Min: Rs {Math.round(shop.minimumOrderValue)}
              </Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {shop.tags && shop.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-1">
            {shop.tags.slice(0, 3).map((tag, index) => (
              <View
                key={index}
                className="bg-blue-50 px-2 py-0.5 rounded-full"
              >
                <Text className="text-primary-600 text-xs font-medium">
                  {tag}
                </Text>
              </View>
            ))}
            {isClosed && (
              <View className="bg-gray-200 px-2 py-0.5 rounded-full">
                <Text className="text-gray-700 text-xs font-medium">Closed</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

