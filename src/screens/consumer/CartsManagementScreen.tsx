import React, { useState, useMemo, useEffect } from 'react';
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
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../context/CartContext';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { useQuery } from 'react-query';
import { findShopsByLocation, fetchShopDetails } from '../../services/consumer/shopService';
import BackIcon from '../../icons/BackIcon';
import DeleteIcon from '../../icons/DeleteIcon';
import LinearGradient from 'react-native-linear-gradient';
import { getCurrentOpeningStatus } from '../../utils/shopOpeningHours';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CartsManagementScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { carts, deleteShopCart, loading: cartsLoading } = useCart();
  const { coords } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const [deletingShopId, setDeletingShopId] = useState<string | null>(null);

  const cartsList = Object.values(carts);

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

  // Fetch shop details for all carts to check opening status
  const shopDetailsQueries = useQuery(
    ['cartShopDetails', cartsList.map(c => c.shopId).join(',')],
    async () => {
      const details = await Promise.all(
        cartsList.map(async (cart) => {
          try {
            const result = await fetchShopDetails(cart.shopId);
            return { shopId: cart.shopId, details: result.data, error: result.error };
          } catch (error) {
            return { shopId: cart.shopId, details: null, error };
          }
        })
      );
      return details.reduce((acc, { shopId, details, error }) => {
        if (details) acc[shopId] = details;
        return acc;
      }, {} as Record<string, any>);
    },
    {
      enabled: cartsList.length > 0,
    }
  );

  // Auto-refresh shop details every 30 seconds for real-time status updates
  useEffect(() => {
    if (!shopDetailsQueries.data || cartsList.length === 0) return;
    
    const interval = setInterval(() => {
      shopDetailsQueries.refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [shopDetailsQueries.data, cartsList.length, shopDetailsQueries.refetch]);

  // Compute opening status for each shop
  const shopOpeningStatuses = useMemo(() => {
    const statuses: Record<string, { isOpen: boolean; reason?: string; holidayDescription?: string }> = {};
    
    if (!shopDetailsQueries.data) return statuses;

    cartsList.forEach((cart) => {
      const shopDetails = shopDetailsQueries.data[cart.shopId];
      if (shopDetails) {
        const openingStatus = getCurrentOpeningStatus({
          opening_hours: shopDetails.opening_hours ?? null,
          holidays: shopDetails.holidays ?? null,
          open_status_mode: shopDetails.open_status_mode ?? undefined,
        });
        statuses[cart.shopId] = {
          isOpen: openingStatus.isOpen,
          reason: openingStatus.reason,
          holidayDescription: openingStatus.holidayDescription,
        };
      } else {
        // If no shop details, assume closed
        statuses[cart.shopId] = { isOpen: false };
      }
    });

    return statuses;
  }, [shopDetailsQueries.data, cartsList]);

  // Check if shop is closed
  const isShopClosed = (shopId: string): boolean => {
    const status = shopOpeningStatuses[shopId];
    return status ? !status.isOpen : false;
  };

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
    const closed = isShopClosed(shopId);
    
    if (closed) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Shop is currently closed.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Shop closed', 'This shop is currently closed.');
      }
      return;
    }
    
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

  // Handle view cart press
  const handleViewCart = (shopId: string) => {
    const closed = isShopClosed(shopId);
    if (closed) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Shop is currently closed.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Shop closed', 'This shop is currently closed.');
      }
      return;
    }
    navigation.navigate('ViewCart', { shopId });
  };

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
    <SafeAreaView className="flex-1 bg-gray-50" edges={[]}>
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

      {/* Header */}
      <LinearGradient
        colors={["#2563eb", "#1d4ed8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
            const closed = isShopClosed(cart.shopId);
            const isDeleting = deletingShopId === cart.shopId;
            const isValidating = shopsLoading;
            const openingStatus = shopOpeningStatuses[cart.shopId];

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
                  opacity: (available && !closed) ? 1 : 0.6,
                }}
              >
                {/* Upper Section: Shop Info (clickable if available and open) */}
                <TouchableOpacity
                  onPress={() => handleShopPress(cart.shopId, cart.shopName)}
                  disabled={!available || closed || isValidating}
                  activeOpacity={(available && !closed && !isValidating) ? 0.7 : 1}
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
                    ) : closed ? (
                      <View className="flex-row items-center mt-1">
                        <View className="bg-red-100 px-2 py-0.5 rounded-full mr-2">
                          <Text className="text-red-700 text-xs font-bold">
                            {t('shopCard.closed').toUpperCase()}
                          </Text>
                        </View>
                        {openingStatus?.holidayDescription && (
                          <Text className="text-red-600 text-xs font-medium flex-1" numberOfLines={1}>
                            {openingStatus.holidayDescription}
                          </Text>
                        )}
                      </View>
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
                    {(available && !closed && !isValidating) && (
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={() => handleViewCart(cart.shopId)}
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
                    {(closed || !available || isValidating) && (
                      <TouchableOpacity
                        onPress={() => {
                          if (closed) {
                            if (Platform.OS === 'android') {
                              ToastAndroid.show('Shop is currently closed.', ToastAndroid.SHORT);
                            } else {
                              Alert.alert('Shop closed', 'This shop is currently closed.');
                            }
                          } else if (!available) {
                            if (Platform.OS === 'android') {
                              ToastAndroid.show('Shop unavailable in your location.', ToastAndroid.SHORT);
                            } else {
                              Alert.alert('Shop unavailable', 'Shop unavailable in your location.');
                            }
                          }
                        }}
                        disabled={closed || !available || isValidating}
                        className={`px-4 py-2 rounded-full bg-gray-300`}
                        activeOpacity={0.8}
                      >
                        <Text className="text-sm font-semibold text-gray-500">
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

