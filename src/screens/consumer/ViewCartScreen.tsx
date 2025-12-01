import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../context/CartContext';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { calculateDistance, calculateTotalDeliveryFee, type DeliveryLogic, fetchDeliveryLogic } from '../../services/merchant/deliveryLogicService';
import { validateCartOrderValue } from '../../services/consumer/shopService';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import BackIcon from '../../icons/BackIcon';
import CartIcon from '../../icons/CartIcon';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ViewCart'>;

interface CartTotals {
  subtotal: number; // in cents
  deliveryFee: number; // in PKR
  surcharge: number; // in PKR
  total: number; // in cents
  freeDeliveryApplied: boolean;
  isCalculating: boolean;
  meetsMinimumOrder: boolean;
  minimumOrderValue: number | null; // in PKR
}

export default function ViewCartScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { shopId } = route.params;
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const { getShopCart, updateItemQuantity } = useCart();
  const { user } = useAuth();

  const currentCart = getShopCart(shopId);
  const effectiveCoords = selectedAddress?.coords || coords;

  // State for totals calculation
  const [totals, setTotals] = useState<CartTotals>({
    subtotal: 0,
    deliveryFee: 0,
    surcharge: 0,
    total: 0,
    freeDeliveryApplied: false,
    isCalculating: true,
    meetsMinimumOrder: true,
    minimumOrderValue: null,
  });

  // Debounce timer ref
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Calculate totals with debouncing and backend validation
  const calculateTotals = useCallback(async () => {
    if (!currentCart) {
      setTotals({
        subtotal: 0,
        deliveryFee: 0,
        surcharge: 0,
        total: 0,
        freeDeliveryApplied: false,
        isCalculating: false,
        meetsMinimumOrder: true,
        minimumOrderValue: null,
      });
      return;
    }

    setTotals((prev) => ({ ...prev, isCalculating: true }));

    try {
      // Fetch fresh delivery logic from backend (real-time, not cached)
      const { data: deliveryLogic, error: deliveryLogicError } = await fetchDeliveryLogic(shopId);

      if (deliveryLogicError) {
        console.error('Error fetching delivery logic:', deliveryLogicError);
      }

      // Calculate distance if we have coordinates
      let distanceInMeters: number | null = null;
      if (
        effectiveCoords?.latitude &&
        effectiveCoords?.longitude &&
        currentCart.shopLatitude &&
        currentCart.shopLongitude
      ) {
        distanceInMeters = calculateDistance(
          effectiveCoords.latitude,
          effectiveCoords.longitude,
          currentCart.shopLatitude,
          currentCart.shopLongitude
        );
      }

      // If no delivery logic exists, just show subtotal and validate
      if (!deliveryLogic) {
        const validationResult = await validateCartOrderValue(shopId, currentCart.totalPrice);

        setTotals({
          subtotal: currentCart.totalPrice,
          deliveryFee: 0,
          surcharge: 0,
          total: currentCart.totalPrice,
          freeDeliveryApplied: false,
          isCalculating: false,
          meetsMinimumOrder: validationResult.data?.meetsMinimumOrder ?? true,
          minimumOrderValue: validationResult.data?.leastOrderValue ?? null,
        });
        return;
      }

      // Calculate delivery fee and surcharge using fresh delivery logic from backend
      // This ensures we use the latest values (surcharge, tiers, etc.) even if merchant changed them
      const orderValue = currentCart.totalPrice / 100; // Convert cents to PKR
      const deliveryCalculation = calculateTotalDeliveryFee(
        orderValue,
        distanceInMeters || 0,
        deliveryLogic
      );

      const subtotal = currentCart.totalPrice; // in cents
      // Calculate total: subtotal + base delivery fee + surcharge
      const baseDeliveryFeeInCents = Math.round(deliveryCalculation.baseFee * 100); // Convert PKR to cents
      const surchargeInCents = Math.round(deliveryCalculation.surcharge * 100); // Convert PKR to cents
      const total = subtotal + baseDeliveryFeeInCents + surchargeInCents;

      // Validate with backend to get current leastOrderValue (real-time validation)
      const validationResult = await validateCartOrderValue(shopId, currentCart.totalPrice);

      setTotals({
        subtotal,
        deliveryFee: deliveryCalculation.baseFee, // Base delivery fee only (from distance tiering)
        surcharge: deliveryCalculation.surcharge, // Order value surcharge (separate)
        total,
        freeDeliveryApplied: deliveryCalculation.freeDeliveryApplied,
        isCalculating: false,
        meetsMinimumOrder: validationResult.data?.meetsMinimumOrder ?? true,
        minimumOrderValue: validationResult.data?.leastOrderValue ?? null,
      });
    } catch (error) {
      console.error('Error calculating totals:', error);
      // On error, allow the order but mark as calculating false
      setTotals((prev) => ({
        ...prev,
        isCalculating: false,
        meetsMinimumOrder: true, // Default to allowing on error
      }));
    }
  }, [currentCart, effectiveCoords, shopId]);

  // Debounced calculation
  const debouncedCalculateTotals = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      await calculateTotals();
    }, 300); // 300ms debounce
  }, [calculateTotals]);

  // Calculate totals on mount
  useEffect(() => {
    if (currentCart) {
      calculateTotals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Debounced recalculation when cart items or price change
  useEffect(() => {
    if (currentCart) {
      debouncedCalculateTotals();
    }
  }, [currentCart?.items, currentCart?.totalPrice, debouncedCalculateTotals]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle quantity change
  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    await updateItemQuantity(shopId, itemId, newQuantity);
    // Totals will be recalculated via useEffect
  };

  // Handle increment
  const handleIncrement = async (itemId: string) => {
    const item = currentCart?.items.find((i) => i.id === itemId);
    if (item) {
      ReactNativeHapticFeedback.trigger('impactLight');
      await handleQuantityChange(itemId, item.quantity + 1);
    }
  };

  // Handle decrement
  const handleDecrement = async (itemId: string) => {
    const item = currentCart?.items.find((i) => i.id === itemId);
    if (item && item.quantity > 0) {
      ReactNativeHapticFeedback.trigger('impactLight');
      await handleQuantityChange(itemId, item.quantity - 1);
    }
  };

  // Handle navigate to shop
  const handleAddMoreItems = () => {
    if (!currentCart) return;

    navigation.navigate('Shop', {
      shopId: currentCart.shopId,
      shop: {
        id: currentCart.shopId,
        name: currentCart.shopName,
        image_url: currentCart.shopImage || '',
        rating: 0,
        orders: undefined,
        delivery_fee: 0,
        delivery_time: undefined,
        tags: [],
        address: currentCart.shopAddress || '',
        latitude: currentCart.shopLatitude,
        longitude: currentCart.shopLongitude,
        is_open: true,
        created_at: new Date().toISOString(),
      },
    });
  };

  if (!currentCart || currentCart.items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">🛒</Text>
          <Text className="text-gray-900 text-lg font-semibold mb-2">{t('cart.empty')}</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 bg-blue-600 px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">{t('cart.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
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
            <Text className="text-gray-900 text-lg font-bold">{currentCart.shopName}</Text>
            <Text className="text-gray-500 text-sm">{currentCart.items.length} {currentCart.items.length === 1 ? t('cart.item') : t('cart.items')}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Items Table */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-2xl overflow-hidden" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}>
          {currentCart.items.map((item, index) => (
            <View
              key={item.id}
              className={`flex-row items-center p-4 ${index < currentCart.items.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              {/* Picture */}
              <View className="mr-3">
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: 60, height: 60 }}
                    resizeMode="cover"
                    className="rounded-xl"
                  />
                ) : (
                  <View className="w-[60px] h-[60px] rounded-xl bg-gray-200 items-center justify-center">
                    <Text className="text-gray-400 text-lg font-bold">
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Name */}
              <View className="flex-1 mr-3">
                <Text className="text-gray-500 text-sm font-normal">
                  {item.name}
                </Text>
                <Text className="text-gray-600 text-sm mt-1">
                  Rs {(item.price_cents / 100).toFixed(0)} {t('cart.each')}
                </Text>
                <Text className="text-gray-900 text-base font-semibold mt-1">
                  Rs {((item.price_cents * item.quantity) / 100).toFixed(0)}
                </Text>
              </View>

              {/* Quantity Controls */}
              <View className="flex-row items-center bg-gray-100 rounded-full px-2 py-1">
                <TouchableOpacity
                  onPress={() => handleDecrement(item.id)}
                  className="items-center justify-center"
                  style={{ width: 36, height: 36 }}
                  activeOpacity={0.7}
                >
                  <Text className="text-gray-700 text-lg font-bold">−</Text>
                </TouchableOpacity>
                <Text className="text-gray-900 text-base font-bold mx-3 min-w-[24px] text-center">
                  {item.quantity}
                </Text>
                <TouchableOpacity
                  onPress={() => handleIncrement(item.id)}
                  className="items-center justify-center"
                  style={{ width: 36, height: 36 }}
                  activeOpacity={0.7}
                >
                  <Text className="text-gray-700 text-lg font-bold">+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Add More Items - Integrated into items list */}
        <TouchableOpacity
          onPress={handleAddMoreItems}
          className="bg-white border border-gray-200 rounded-2xl mt-2 py-3 px-4 flex-row items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="text-gray-600 text-base mr-2">+</Text>
          <Text className="text-gray-600 text-base font-medium">{t('cart.addMore')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky Footer with Totals and Checkout Button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 12) + 8,
          paddingHorizontal: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        {/* Totals */}
        <View className="mb-4">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600 text-base">{t('cart.subtotal')}</Text>
            <Text className="text-gray-900 text-base font-semibold">
              Rs {(totals.subtotal / 100).toFixed(0)}
            </Text>
          </View>

          {totals.surcharge > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600 text-base">{t('cart.surcharge')}</Text>
              <Text className="text-gray-900 text-base font-semibold">
                Rs {totals.surcharge.toFixed(0)}
              </Text>
            </View>
          )}

          {totals.freeDeliveryApplied ? (
            <View className="flex-row justify-between mb-2">
              <Text className="text-green-600 text-base font-semibold">{t('cart.freeDelivery')}</Text>
              <Text className="text-green-600 text-base font-semibold">Rs 0</Text>
            </View>
          ) : totals.deliveryFee > 0 ? (
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600 text-base">{t('cart.delivery')}</Text>
              <Text className="text-gray-900 text-base font-semibold">
                Rs {totals.deliveryFee.toFixed(0)}
              </Text>
            </View>
          ) : null}

          {totals.isCalculating && (
            <View className="flex-row items-center justify-center py-2">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-gray-500 text-sm ml-2">{t('cart.calculating')}</Text>
            </View>
          )}

          <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
            <Text className="text-gray-900 text-lg font-bold">{t('cart.total')}</Text>
            <Text className="text-gray-900 text-lg font-bold">
              Rs {(totals.total / 100).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Minimum Order Value Warning */}
        {!totals.meetsMinimumOrder && totals.minimumOrderValue !== null && (
          <View className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <Text className="text-amber-800 text-sm font-semibold text-center">
              {t('cart.minOrderWarning', { amount: totals.minimumOrderValue.toFixed(0) })}
            </Text>
            <Text className="text-amber-700 text-xs text-center mt-1">
              {t('cart.addMoreToProceed')}
            </Text>
          </View>
        )}

        {/* Proceed to Checkout Button */}
        <TouchableOpacity
          onPress={() => {
            // Check if user is authenticated
            if (!user) {
              // Navigate to SignUp screen, and return to ViewCart after signup
              navigation.navigate('SignUp', { returnTo: 'ViewCart' });
              return;
            }
            // User is authenticated, proceed to checkout
            navigation.navigate('Checkout', { shopId });
          }}
          disabled={totals.isCalculating || !totals.meetsMinimumOrder}
          className={`rounded-2xl py-4 px-6 items-center justify-center ${totals.isCalculating || !totals.meetsMinimumOrder ? 'bg-gray-300' : 'bg-blue-600'
            }`}
          activeOpacity={totals.isCalculating || !totals.meetsMinimumOrder ? 1 : 0.8}
        >
          {totals.isCalculating ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text className="text-white font-bold text-lg ml-2">{t('cart.calculating')}</Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <Text className="text-white font-bold text-lg mr-2">{t('cart.proceedToCheckout')}</Text>
              <Text className="text-white font-bold text-lg">
                Rs {(totals.total / 100).toFixed(0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

