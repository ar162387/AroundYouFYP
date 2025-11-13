import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  ToastAndroid,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../context/CartContext';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { useQuery } from 'react-query';
import { findShopsByLocation } from '../../services/consumer/shopService';
import BackIcon from '../../icons/BackIcon';
import DeleteIcon from '../../icons/DeleteIcon';
import LinearGradient from 'react-native-linear-gradient';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CartsManagementScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { carts, deleteShopCart, loading: cartsLoading } = useCart();
  const { coords } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const [deletingShopId, setDeletingShopId] = useState<string | null>(null);

  // Get effective coordinates (from selected address or user location)
  const effectiveCoords = selectedAddress?.coords || coords;

  // Use the SAME RPC function as HomeScreen to check which shops are available
  // This guarantees 100% consistency with server-side PostGIS ST_Contains logic
  const { data: availableShops, isLoading: shopsLoading } = useQuery(
    ['availableShops', effectiveCoords?.latitude, effectiveCoords?.longitude],
    async () => {
      if (!effectiveCoords?.latitude || !effectiveCoords?.longitude) {
        return [];
      }
      
      const result = await findShopsByLocation(
        effectiveCoords.latitude,
        effectiveCoords.longitude
      );
      
      if (result.error) {
        console.error('Error fetching available shops:', result.error);
        return [];
      }
      
      return result.data || [];
    },
    {
      enabled: !!effectiveCoords?.latitude && !!effectiveCoords?.longitude,
      // Refetch when coordinates change
      keepPreviousData: false,
    }
  );

  // Create a Set of available shop IDs for O(1) lookup
  const availableShopIds = useMemo(() => {
    if (!availableShops) return new Set<string>();
    return new Set(availableShops.map(shop => shop.id));
  }, [availableShops]);

  // Check if shop is available using server-side validation results
  const isShopAvailable = (shopId: string): boolean => {
    // If we don't have coords or still loading, consider unavailable
    if (!effectiveCoords) {
      console.log(`No coordinates for validation`);
      return false;
    }
    
    if (shopsLoading) {
      console.log(`Still loading available shops`);
      return false;
    }

    // Check if shop is in the available shops list (from server-side ST_Contains)
    const isAvailable = availableShopIds.has(shopId);
    console.log(`Shop ${shopId} availability check:`, {
      isAvailable,
      userLocation: effectiveCoords,
      totalAvailableShops: availableShopIds.size,
    });
    
    return isAvailable;
  };

  // Handle delete cart with confirmation
  const handleDeleteCart = (shopId: string, shopName: string) => {
    Alert.alert(
      'Delete Cart',
      `Remove all items from ${shopName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingShopId(shopId);
            await deleteShopCart(shopId);
            setDeletingShopId(null);
            if (Platform.OS === 'android') {
              ToastAndroid.show(`Cart deleted: ${shopName}`, ToastAndroid.SHORT);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Handle shop banner press
  const handleShopPress = (shopId: string, shopName: string) => {
    const available = isShopAvailable(shopId);
    
    if (!available) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Shop unavailable in your location.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Shop unavailable', 'Shop unavailable in your location.');
      }
      return;
    }

    const cart = carts[shopId];
    navigation.navigate('Shop', { 
      shopId,
      shop: {
        id: shopId,
        name: cart.shopName,
        image_url: cart.shopImage || '',
        rating: 0,
        orders: undefined,
        delivery_fee: 0,
        delivery_time: undefined,
        tags: [],
        address: cart.shopAddress || '',
        latitude: cart.shopLatitude,
        longitude: cart.shopLongitude,
        is_open: true,
        created_at: new Date().toISOString(),
      }
    });
  };

  const cartsList = Object.values(carts);

  // Show loading only if we're still loading cart data (not delivery areas)
  if (cartsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-600 mt-4">Loading carts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="pb-3 px-5"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
            activeOpacity={0.7}
          >
            <BackIcon size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-lg font-bold">Your Carts</Text>
            <Text className="text-white/90 text-sm" numberOfLines={1}>
              {selectedAddress?.label || 'Current location'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Carts List */}
      {cartsList.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">🛒</Text>
          <Text className="text-gray-900 text-lg font-semibold mb-2">No carts yet</Text>
          <Text className="text-gray-500 text-center">
            Browse shops and add items to your cart to see them here
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {cartsList.map((cart) => {
            const available = isShopAvailable(cart.shopId);
            const isDeleting = deletingShopId === cart.shopId;
            const isValidating = shopsLoading;

            return (
              <View
                key={cart.shopId}
                className="mb-4 bg-white rounded-2xl overflow-hidden"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                  opacity: available ? 1 : 0.6,
                }}
              >
                {/* Upper Section: Shop Info (clickable if available) */}
                <TouchableOpacity
                  onPress={() => handleShopPress(cart.shopId, cart.shopName)}
                  disabled={!available || isValidating}
                  activeOpacity={available && !isValidating ? 0.7 : 1}
                  className="flex-row items-center p-4 border-b border-gray-100"
                >
                  {/* Shop Image */}
                  {cart.shopImage ? (
                    <Image
                      source={{ uri: cart.shopImage }}
                      className="w-16 h-16 rounded-xl mr-3"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-16 h-16 rounded-xl bg-gray-200 items-center justify-center mr-3">
                      <Text className="text-gray-500 text-2xl font-bold">
                        {cart.shopName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* Shop Name & Address */}
                  <View className="flex-1">
                    <Text className="text-gray-900 text-base font-bold" numberOfLines={1}>
                      {cart.shopName}
                    </Text>
                    {cart.shopAddress && (
                      <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={1}>
                        {cart.shopAddress}
                      </Text>
                    )}
                    {isValidating ? (
                      <Text className="text-gray-400 text-xs mt-1 font-semibold">
                        Checking availability...
                      </Text>
                    ) : !available ? (
                      <Text className="text-red-600 text-xs mt-1 font-semibold">
                        Unavailable in your location
                      </Text>
                    ) : null}
                  </View>

                  {/* Delete Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteCart(cart.shopId, cart.shopName)}
                    disabled={isDeleting}
                    className="ml-2 p-2"
                    activeOpacity={0.7}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <DeleteIcon size={24} color="#EF4444" />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Lower Section: Items & Total */}
                <View className="p-4">
                  {/* Items List */}
                  <Text className="text-gray-500 text-sm leading-tight" numberOfLines={2}>
                    {cart.items
                      .map((item) => `${item.name} x ${item.quantity}`)
                      .join(', ')}
                  </Text>

                  {/* Total & Actions */}
                  <View className="flex-row items-center justify-between mt-3">
                    <Text className="text-gray-900 text-lg font-bold">
                      Rs {(cart.totalPrice / 100).toFixed(0)}
                    </Text>
                    {available && !isValidating && (
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={() => navigation.navigate('ViewCart', { shopId: cart.shopId })}
                          className="bg-blue-600 px-4 py-2 rounded-full mr-2"
                          activeOpacity={0.8}
                        >
                          <Text className="text-white text-sm font-semibold">View Cart</Text>
                        </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleShopPress(cart.shopId, cart.shopName)}
                        activeOpacity={0.7}
                      >
                        <Text className="text-blue-600 text-sm font-semibold">
                            Add more →
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {(!available || isValidating) && (
                      <TouchableOpacity
                        onPress={() => {
                          if (Platform.OS === 'android') {
                            ToastAndroid.show('Shop unavailable in your location.', ToastAndroid.SHORT);
                          } else {
                            Alert.alert('Shop unavailable', 'Shop unavailable in your location.');
                          }
                        }}
                        disabled={!available || isValidating}
                        className={`px-4 py-2 rounded-full ${!available || isValidating ? 'bg-gray-300' : 'bg-blue-600'}`}
                        activeOpacity={0.8}
                      >
                        <Text className={`text-sm font-semibold ${!available || isValidating ? 'text-gray-500' : 'text-white'}`}>
                          View Cart
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Bottom spacing */}
          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

