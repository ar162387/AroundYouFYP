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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useQuery } from 'react-query';
import { fetchShopItems, fetchShopDetails, ShopItem } from '../../services/consumer/shopService';
import { useCart } from '../../context/CartContext';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import BackIcon from '../../icons/BackIcon';
import CartIcon from '../../icons/CartIcon';
import CategoryItemsSkeleton from '../../skeleton/CategoryItemsSkeleton';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CategoryItems'>;

export default function CategoryItemsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { shopId, categoryId, categoryName } = route.params;
  const insets = useSafeAreaInsets();
  const { addItemToCart, removeItemFromCart, getShopCart } = useCart();

  // Get current cart for this shop
  const currentCart = getShopCart(shopId);

  // Fetch shop details for cart operations
  const { data: shopDetails } = useQuery(['shopDetails', shopId], async () => {
    const result = await fetchShopDetails(shopId);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

  // Fetch all items for this category
  const { data: items, isLoading } = useQuery(['categoryItems', shopId, categoryId], async () => {
    const result = await fetchShopItems(shopId, categoryId);
    if (result.error) throw new Error(result.error.message);
    return result.data || [];
  });

  // Filter out inactive items
  const activeItems = React.useMemo(() => {
    if (!items) return [];
    return items.filter((item) => item.is_active === true);
  }, [items]);

  // Helper function to get item quantity from cart
  const getItemQuantity = (itemId: string): number => {
    if (!currentCart) return 0;
    const cartItem = currentCart.items.find(item => item.id === itemId);
    return cartItem?.quantity || 0;
  };

  // Handle adding item to cart
  const handleAddToCart = async (item: ShopItem) => {
    if (!shopDetails) return;
    ReactNativeHapticFeedback.trigger('impactLight');
    await addItemToCart(shopId, item, {
      name: shopDetails.name,
      image_url: shopDetails.image_url || undefined,
      address: shopDetails.address || undefined,
      latitude: shopDetails.latitude,
      longitude: shopDetails.longitude,
      deliveryLogic: shopDetails.deliveryLogic,
    });
  };

  // Handle removing item from cart
  const handleRemoveFromCart = async (itemId: string) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    await removeItemFromCart(shopId, itemId);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#1e3a8a', '#2563eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
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
            <Text className="text-white text-sm">{activeItems?.length || 0} {t('shop.items')}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Items Grid */}
      {isLoading ? (
        <CategoryItemsSkeleton />
      ) : (
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{
            padding: 12,
            paddingBottom: currentCart && currentCart.totalItems > 0 ? 140 : 40,
          }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => {
            const quantity = getItemQuantity(item.id);
            return (
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
                      {/* Cart Controls */}
                      {quantity === 0 ? (
                        <TouchableOpacity
                          onPress={() => handleAddToCart(item)}
                          className="absolute bottom-2 right-2 bg-blue-600 rounded-full items-center justify-center"
                          style={{
                            width: 44,
                            height: 44,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 4,
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className="text-white text-xl font-bold">+</Text>
                        </TouchableOpacity>
                      ) : (
                        <View className="absolute bottom-2 right-2 flex-row items-center bg-blue-600 rounded-full px-2 py-1.5"
                          style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 4,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => handleRemoveFromCart(item.id)}
                            style={{ width: 40, height: 40 }}
                            className="items-center justify-center"
                            activeOpacity={0.7}
                          >
                            <Text className="text-white text-lg font-bold">−</Text>
                          </TouchableOpacity>
                          <Text className="text-white text-sm font-bold mx-2 min-w-[24px] text-center">
                            {quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleAddToCart(item)}
                            style={{ width: 40, height: 40 }}
                            className="items-center justify-center"
                            activeOpacity={0.7}
                          >
                            <Text className="text-white text-lg font-bold">+</Text>
                          </TouchableOpacity>
                        </View>
                      )}
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
                      {/* Cart Controls */}
                      {quantity === 0 ? (
                        <TouchableOpacity
                          onPress={() => handleAddToCart(item)}
                          className="absolute bottom-2 right-2 bg-blue-600 rounded-full items-center justify-center"
                          style={{
                            width: 44,
                            height: 44,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 4,
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className="text-white text-xl font-bold">+</Text>
                        </TouchableOpacity>
                      ) : (
                        <View className="absolute bottom-2 right-2 flex-row items-center bg-blue-600 rounded-full px-2 py-1.5"
                          style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 4,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => handleRemoveFromCart(item.id)}
                            style={{ width: 40, height: 40 }}
                            className="items-center justify-center"
                            activeOpacity={0.7}
                          >
                            <Text className="text-white text-lg font-bold">−</Text>
                          </TouchableOpacity>
                          <Text className="text-white text-sm font-bold mx-2 min-w-[24px] text-center">
                            {quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleAddToCart(item)}
                            style={{ width: 40, height: 40 }}
                            className="items-center justify-center"
                            activeOpacity={0.7}
                          >
                            <Text className="text-white text-lg font-bold">+</Text>
                          </TouchableOpacity>
                        </View>
                      )}
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
            );
          }}
          ListEmptyComponent={
            <View className="py-12 items-center w-full">
              <Text className="text-5xl mb-3">📦</Text>
              <Text className="text-gray-900 font-semibold text-lg mb-2">{t('shop.noItemsAvailable')}</Text>
              <Text className="text-gray-500 text-center">{t('shop.categoryEmpty')}</Text>
            </View>
          }
        />
      )}

      {/* Sticky Cart Footer - Shows only when cart has items */}
      {currentCart && currentCart.totalItems > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#2563eb',
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            paddingTop: 18,
            paddingHorizontal: 20,
            shadowColor: '#2563eb',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.6,
            shadowRadius: 16,
            elevation: 20,
            zIndex: 90,
            borderTopWidth: 2,
            borderTopColor: 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate('ViewCart', { shopId })}
            activeOpacity={0.8}
            className="flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1">
              <View className="bg-white/30 rounded-full w-12 h-12 items-center justify-center mr-3">
                <CartIcon size={22} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-lg">{t('shop.viewCart')}</Text>
                <Text className="text-white/95 text-sm">
                  {currentCart.totalItems} {currentCart.totalItems === 1 ? t('shop.item') : t('shop.items')}
                </Text>
              </View>
            </View>
            <View className="bg-white/30 rounded-xl px-5 py-2.5">
              <Text className="text-white font-bold text-xl">
                Rs {(currentCart.totalPrice / 100).toFixed(0)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

