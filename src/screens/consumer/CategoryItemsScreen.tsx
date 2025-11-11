import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useQuery } from 'react-query';
import { fetchShopItems } from '../../services/consumer/shopService';
import BackIcon from '../../icons/BackIcon';
import CategoryItemsSkeleton from '../../skeleton/CategoryItemsSkeleton';
import LinearGradient from 'react-native-linear-gradient';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CategoryItems'>;

export default function CategoryItemsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { shopId, categoryId, categoryName } = route.params;

  // Fetch all items for this category
  const { data: items, isLoading } = useQuery(['categoryItems', shopId, categoryId], async () => {
    const result = await fetchShopItems(shopId, categoryId);
    if (result.error) throw new Error(result.error.message);
    return result.data || [];
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#1e3a8a', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="mr-3 w-8 h-8 items-center justify-center"
          >
            <BackIcon size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white flex-1" numberOfLines={1}>
            {categoryName}
          </Text>
          <Text className="text-white text-sm">{items?.length || 0} items</Text>
        </View>
      </LinearGradient>

      {/* Items Grid */}
      {isLoading ? (
        <CategoryItemsSkeleton />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => (
            <View className="items-center mb-3" style={{ width: '48%' }}>
              {/* Item Image with Card Style */}
              <View className="relative">
                {item.image_url ? (
                  <View
                    className="bg-white rounded-2xl overflow-hidden items-center justify-center"
                    style={{
                      width: 140,
                      height: 140,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    <Image
                      source={{ uri: item.image_url }}
                      style={{ width: 120, height: 120 }}
                      resizeMode="contain"
                      onError={(error) => {
                        console.log('Category image load error:', item.name, item.image_url, error.nativeEvent.error);
                      }}
                      onLoad={() => {
                        console.log('Category image loaded:', item.name, item.image_url);
                      }}
                    />
                    {/* Plus Button */}
                    <TouchableOpacity
                      className="absolute bottom-2 right-2 bg-blue-600 rounded-full w-8 h-8 items-center justify-center"
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 4,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-white text-lg font-bold">+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View
                    className="bg-gray-50 rounded-2xl overflow-hidden items-center justify-center"
                    style={{
                      width: 140,
                      height: 140,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    <View className="w-20 h-20 rounded-full bg-gray-200 items-center justify-center">
                      <Text className="text-gray-400 text-2xl font-bold">{item.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    {/* Plus Button */}
                    <TouchableOpacity
                      className="absolute bottom-2 right-2 bg-blue-600 rounded-full w-8 h-8 items-center justify-center"
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 4,
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-white text-lg font-bold">+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Item Name - Centered, Lighter, 3 lines */}
              <View className="mt-3 px-2 w-full">
                <Text
                  className="text-sm text-gray-600 text-center leading-tight"
                  numberOfLines={3}
                  style={{ minHeight: 48 }}
                >
                  {item.name}
                </Text>
              </View>

              {/* Price - Centered */}
              <View className="mt-1">
                <Text className="text-base font-bold text-gray-900 text-center">
                  Rs {(item.price_cents / 100).toFixed(0)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View className="py-12 items-center w-full">
              <Text className="text-5xl mb-3">📦</Text>
              <Text className="text-gray-900 font-semibold text-lg mb-2">No items available</Text>
              <Text className="text-gray-500 text-center">This category doesn't have any items yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

