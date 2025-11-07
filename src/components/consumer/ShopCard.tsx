
import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { Shop } from '../../services/supabase';

interface ShopCardProps {
  shop: Shop;
  onPress?: () => void;
}

export default function ShopCard({ shop, onPress }: ShopCardProps) {
  const isClosed = !shop.is_open;
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-2xl shadow-lg mb-4 overflow-hidden ${isClosed ? 'bg-gray-100' : 'bg-white'}`}
      activeOpacity={0.7}
    >
      {/* Shop Image */}
      {shop.image_url ? (
        <Image
          source={{ uri: shop.image_url }}
          className="w-full h-48"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-48 bg-gray-200 items-center justify-center">
          <Text className="text-gray-400 text-lg">No Image</Text>
        </View>
      )}

      {/* Shop Info */}
      <View className="p-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-lg font-bold text-gray-800 flex-1">
            {shop.name}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-yellow-500 text-base mr-1">★</Text>
            <Text className="text-gray-700">
              {shop.rating > 0 ? shop.rating.toFixed(1) : 'N/A'} {shop.orders ? `(${shop.orders.toLocaleString()})` : ''}
            </Text>
          </View>
        </View>

        {/* Delivery Fee and Time */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-600 text-sm">
            {shop.delivery_time || 'N/A'}
          </Text>
          <Text className="text-primary-600">
            {shop.delivery_fee > 0 ? `Rs ${shop.delivery_fee.toFixed(0)} delivery` : 'N/A'}
          </Text>
        </View>

        {/* Tags */}
        <View className="flex-row flex-wrap gap-2">
          {shop.tags.map((tag, index) => (
            <View
              key={index}
              className="bg-blue-50 px-3 py-1 rounded-full"
            >
              <Text className="text-primary-600 text-xs font-medium">
                {tag}
              </Text>
            </View>
          ))}
          {isClosed && (
            <View className="bg-gray-200 px-3 py-1 rounded-full">
              <Text className="text-gray-700 text-xs font-medium">Closed</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

