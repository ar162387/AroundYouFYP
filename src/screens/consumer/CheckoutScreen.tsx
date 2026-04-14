import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker } from 'react-native-maps';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../context/CartContext';
import { useLocationSelection } from '../../context/LocationContext';
import { calculateDistance, calculateTotalDeliveryFee, fetchDeliveryLogic } from '../../services/merchant/deliveryLogicService';
import { validateDeliveryAddress } from '../../services/consumer/shopService';
import * as addressService from '../../services/consumer/addressService';
import { usePlaceOrder } from '../../hooks/consumer/useOrders';
import { PaymentMethod } from '../../types/orders';
import BackIcon from '../../icons/BackIcon';
import MoneyIcon from '../../icons/MoneyIcon';
import AddressSelectionBottomSheet from '../../components/consumer/AddressSelectionBottomSheet';
import LocationMarkerIcon from '../../icons/LocationMarkerIcon';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Checkout'>;

interface CheckoutTotals {
  subtotal: number; // in cents
  deliveryFee: number; // in PKR
  surcharge: number; // in PKR
  total: number; // in cents
  freeDeliveryApplied: boolean;
}

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const shopId = route.params?.shopId;
  const insets = useSafeAreaInsets();
  const { getShopCart, deleteShopCart } = useCart();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();

  const currentCart = shopId ? getShopCart(shopId) : null;

  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [isCalculatingTotals, setIsCalculatingTotals] = useState(true);
  const [addressId, setAddressId] = useState<string | undefined>(undefined);
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressLandmark, setAddressLandmark] = useState('');
  const [landmark, setLandmark] = useState<string | undefined>(undefined);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [totals, setTotals] = useState<CheckoutTotals>({
    subtotal: 0,
    deliveryFee: 0,
    surcharge: 0,
    total: 0,
    freeDeliveryApplied: false,
  });

  const placeOrderMutation = usePlaceOrder();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [inlineAddressSubmitAttempted, setInlineAddressSubmitAttempted] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const inlineAddressSectionRef = useRef<View>(null);
  const streetInputRef = useRef<TextInput>(null);
  const cityInputRef = useRef<TextInput>(null);
  const landmarkInputRef = useRef<TextInput>(null);

  const focusFirstMissingInlineField = useCallback(
    (trimmedStreet: string, trimmedCity: string, trimmedLandmark: string) => {
      const scrollInlineIntoView = () => {
        const scrollNode = scrollViewRef.current;
        const sectionNode = inlineAddressSectionRef.current;
        if (!scrollNode || !sectionNode) return;
        sectionNode.measureLayout(
          scrollNode as unknown as View,
          (_x, y) => {
            scrollNode.scrollTo({ y: Math.max(0, y - 16), animated: true });
          },
          () => undefined
        );
      };

      requestAnimationFrame(() => {
        scrollInlineIntoView();
        setTimeout(() => {
          if (!trimmedStreet) {
            streetInputRef.current?.focus();
            return;
          }
          if (!trimmedCity) {
            cityInputRef.current?.focus();
            return;
          }
          if (!trimmedLandmark) {
            landmarkInputRef.current?.focus();
          }
        }, 50);
      });
    },
    []
  );

  // Initialize address state when selected address changes
  useEffect(() => {
    if (!selectedAddress) {
      setAddressId(undefined);
      setAddressStreet('');
      setAddressCity('');
      setAddressLandmark('');
      setInlineAddressSubmitAttempted(false);
      return;
    }

    setAddressId(selectedAddress.addressId);
    setAddressStreet(selectedAddress.label || '');
    setAddressCity(selectedAddress.city || '');
    setAddressLandmark(selectedAddress.landmark || '');
    setInlineAddressSubmitAttempted(false);
  }, [selectedAddress]);

  useEffect(() => {
    if (
      !inlineAddressSubmitAttempted ||
      !addressStreet.trim() ||
      !addressCity.trim() ||
      !addressLandmark.trim()
    ) {
      return;
    }
    setInlineAddressSubmitAttempted(false);
  }, [addressStreet, addressCity, addressLandmark, inlineAddressSubmitAttempted]);

  // Calculate totals when address or cart changes
  // This handles all edge cases including:
  // - Distance tiering changes (auto or custom)
  // - Free delivery threshold changes (if user moves outside free delivery radius)
  // - Small order surcharge changes based on order value
  const calculateTotals = useCallback(async () => {
    if (!shopId || !currentCart || !selectedAddress) {
      setTotals({
        subtotal: currentCart?.totalPrice || 0,
        deliveryFee: 0,
        surcharge: 0,
        total: currentCart?.totalPrice || 0,
        freeDeliveryApplied: false,
      });
      setIsCalculatingTotals(false);
      return;
    }

    setIsCalculatingTotals(true);

    try {
      // Fetch fresh delivery logic from backend for real-time pricing
      const { data: deliveryLogic, error: deliveryLogicError } = await fetchDeliveryLogic(shopId);

      if (deliveryLogicError) {
        console.error('Error fetching delivery logic:', deliveryLogicError);
      }

      if (!deliveryLogic) {
        // No delivery logic = no delivery fee
        setTotals({
          subtotal: currentCart.totalPrice,
          deliveryFee: 0,
          surcharge: 0,
          total: currentCart.totalPrice,
          freeDeliveryApplied: false,
        });
        setIsCalculatingTotals(false);
        return;
      }

      // Calculate precise distance from new address to shop
      let distanceInMeters = 0;
      if (
        selectedAddress.coords &&
        currentCart.shopLatitude &&
        currentCart.shopLongitude
      ) {
        distanceInMeters = calculateDistance(
          selectedAddress.coords.latitude,
          selectedAddress.coords.longitude,
          currentCart.shopLatitude,
          currentCart.shopLongitude
        );
        console.log('Distance from new address to shop:', distanceInMeters, 'meters');
      }

      // Calculate delivery fee with all edge cases:
      // - Distance tiers (auto or custom mode)
      // - Free delivery (checks if within radius AND above threshold)
      // - Small order surcharge (applied if below minimum order value)
      const orderValue = currentCart.totalPrice / 100; // Convert cents to PKR
      const deliveryCalculation = calculateTotalDeliveryFee(
        orderValue,
        distanceInMeters,
        deliveryLogic
      );

      console.log('Delivery calculation:', {
        orderValue,
        distanceInMeters,
        baseFee: deliveryCalculation.baseFee,
        surcharge: deliveryCalculation.surcharge,
        freeDeliveryApplied: deliveryCalculation.freeDeliveryApplied,
      });

      const subtotal = currentCart.totalPrice;
      const baseDeliveryFeeInCents = Math.round(deliveryCalculation.baseFee * 100);
      const surchargeInCents = Math.round(deliveryCalculation.surcharge * 100);
      const total = subtotal + baseDeliveryFeeInCents + surchargeInCents;

      setTotals({
        subtotal,
        deliveryFee: deliveryCalculation.baseFee,
        surcharge: deliveryCalculation.surcharge,
        total,
        freeDeliveryApplied: deliveryCalculation.freeDeliveryApplied,
      });
    } catch (error) {
      console.error('Error calculating totals:', error);
      // On error, show subtotal only
      setTotals({
        subtotal: currentCart.totalPrice,
        deliveryFee: 0,
        surcharge: 0,
        total: currentCart.totalPrice,
        freeDeliveryApplied: false,
      });
    } finally {
      setIsCalculatingTotals(false);
    }
  }, [currentCart, selectedAddress, shopId]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  // Fetch landmark from database when addressId is available
  useEffect(() => {
    const fetchLandmark = async () => {
      if (addressId) {
        try {
          const { data: addresses, error } = await addressService.getUserAddresses();
          if (!error && addresses) {
            const address = addresses.find(addr => addr.id === addressId);
            if (address) {
              setLandmark(address.landmark ?? undefined);
            }
          }
        } catch (error) {
          console.error('Error fetching landmark:', error);
        }
      } else {
        setLandmark(undefined);
      }
    };

    fetchLandmark();
  }, [addressId]);

  // Validate address when selected
  const handleSelectAddress = async (address: {
    label: string;
    city: string;
    coords: { latitude: number; longitude: number };
    isCurrent: boolean;
    addressId?: string;
    landmark?: string | null;
  }) => {
    if (!shopId) {
      return;
    }

    setIsValidatingAddress(true);

    try {
      // Validate if address is within delivery zone
      const { data, error } = await validateDeliveryAddress(
        shopId,
        address.coords.latitude,
        address.coords.longitude
      );

      if (error) {
        Alert.alert(t('checkout.validationError'), t('checkout.validationMsg'));
        setIsValidatingAddress(false);
        return;
      }

      if (!data?.isWithinDeliveryZone) {
        Alert.alert(
          t('checkout.deliveryUnavailable'),
          t('checkout.unavailableMsg'),
          [{ text: t('profile.ok') }]
        );
        setIsValidatingAddress(false);
        return;
      }

      // Address is valid, set it and recalculate delivery fees
      setSelectedAddress(address);
      setAddressId(address.addressId);
      setLandmark(address.landmark || undefined);
      setShowAddressSheet(false);

      // Totals will automatically recalculate via useEffect
      // This handles edge cases like:
      // - Moving from free delivery zone to paid delivery zone
      // - Distance tier changes (different delivery fees based on distance)
      // - Any changes in delivery logic
    } catch (error) {
      console.error('Error validating address:', error);
      Alert.alert(t('profile.error'), t('checkout.validationMsg'));
    } finally {
      setIsValidatingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (isPlacingOrder || placeOrderMutation.isLoading) {
      return;
    }

    if (!shopId) {
      return;
    }

    if (!selectedAddress) {
      Alert.alert(t('checkout.addressRequired'), t('checkout.selectAddressMsg'));
      return;
    }

    if (isCalculatingTotals) {
      Alert.alert(t('checkout.pleaseWait'), t('checkout.calculatingMsg'));
      return;
    }

    // By tapping Place Order, user agrees to terms & conditions
    try {
      setIsPlacingOrder(true);
      if (!currentCart) {
        Alert.alert(t('cart.empty'), t('checkout.selectAddressMsg'));
        return;
      }

      let resolvedAddressId = addressId;

      if (!resolvedAddressId) {
        const trimmedStreet = addressStreet.trim();
        const trimmedCity = addressCity.trim();
        const trimmedLandmark = addressLandmark.trim();

        if (!selectedAddress.coords) {
          Alert.alert(t('checkout.addressError'), t('checkout.saveAddressMsg'));
          return;
        }

        if (!trimmedStreet || !trimmedCity || !trimmedLandmark) {
          setInlineAddressSubmitAttempted(true);
          focusFirstMissingInlineField(trimmedStreet, trimmedCity, trimmedLandmark);
          return;
        }

        const { data: createdAddress, error: createAddressError } = await addressService.createAddress({
          street_address: trimmedStreet,
          city: trimmedCity,
          latitude: selectedAddress.coords.latitude,
          longitude: selectedAddress.coords.longitude,
          landmark: trimmedLandmark,
          formatted_address: selectedAddress.label || trimmedStreet,
        });

        if (createAddressError || !createdAddress) {
          Alert.alert(t('checkout.addressError'), createAddressError?.message || t('checkout.saveAddressMsg'));
          return;
        }

        resolvedAddressId = createdAddress.id;
        setAddressId(createdAddress.id);
        setLandmark(createdAddress.landmark || trimmedLandmark);
        setSelectedAddress({
          label: createdAddress.street_address,
          city: createdAddress.city,
          coords: {
            latitude: Number(createdAddress.latitude),
            longitude: Number(createdAddress.longitude),
          },
          isCurrent: false,
          addressId: createdAddress.id,
          landmark: createdAddress.landmark || trimmedLandmark,
        });
      }

      const orderItems = currentCart.items.map(item => ({
        merchant_item_id: item.id,
        quantity: item.quantity,
      }));

      const response = await placeOrderMutation.mutateAsync({
        shop_id: shopId,
        consumer_address_id: resolvedAddressId,
        items: orderItems,
        payment_method: paymentMethod,
        special_instructions: deliveryInstructions || undefined,
      });

      if (response.success && response.order) {
        // Clear cart for this shop
        await deleteShopCart(shopId);

        // Navigate to order status screen
        navigation.reset({
          index: 1,
          routes: [
            { name: 'Home' },
            { name: 'OrderStatus', params: { orderId: response.order.id } },
          ],
        });
      } else {
        // Check if it's a duplicate order error
        const errorMessage = response.message || 'Could not place your order. Please try again.';
        if (errorMessage.includes('duplicate') || errorMessage.includes('23505')) {
          Alert.alert(
            t('checkout.orderProcessing'),
            t('checkout.processingMsg'),
            [
              {
                text: t('profile.ok'),
                onPress: () => {
                  // Navigate to orders list to see if order was created
                  navigation.navigate('OrdersList' as any);
                },
              },
            ]
          );
        } else {
          Alert.alert(t('checkout.orderFailed'), errorMessage);
        }
      }
    } catch (error: any) {
      console.error('Error placing order:', error);

      // Check for duplicate key error
      const errorCode = error?.code || error?.error?.code;
      const errorMessage = error?.message || error?.error?.message || '';

      if (errorCode === '23505' || errorMessage.includes('duplicate key')) {
        Alert.alert(
          t('checkout.orderProcessing'),
          t('checkout.processingMsg'),
          [
            {
              text: t('profile.ok'),
              onPress: () => {
                // Navigate to orders list to see if order was created
                navigation.navigate('OrdersList' as any);
              },
            },
          ]
        );
      } else {
        Alert.alert(t('profile.error'), t('checkout.failedMsg'));
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!shopId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">
            {t('checkout.missingShop', { defaultValue: 'Something went wrong opening checkout.' })}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.replace('CartsManagement')}
            className="mt-4 bg-blue-600 px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">
              {t('cart.viewAllCarts', { defaultValue: 'View all carts' })}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

  const requiresInlineAddressDetails = Boolean(selectedAddress?.coords) && !addressId;
  const hasInlineAddressDetails =
    addressStreet.trim().length > 0 &&
    addressCity.trim().length > 0 &&
    addressLandmark.trim().length > 0;
  const canPlaceOrder =
    Boolean(selectedAddress) &&
    !isValidatingAddress &&
    !isCalculatingTotals &&
    !placeOrderMutation.isLoading;

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
            <Text className="text-gray-900 text-lg font-bold">{t('checkout.title')}</Text>
            <Text className="text-gray-500 text-sm">{currentCart.shopName}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Delivery Address Section */}
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <View className="mr-2">
              <LocationMarkerIcon size={22} color="#2563EB" innerColor="#FFFFFF" accentColor="rgba(255,255,255,0.25)" />
            </View>
            <Text className="text-lg font-bold text-gray-900">{t('checkout.deliveryAddress')}</Text>
          </View>

          <View className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {selectedAddress && selectedAddress.coords ? (
              <>
                {/* Map Preview */}
                <View style={{ height: 150 }}>
                  <MapView
                    style={{ width: '100%', height: '100%' }}
                    pointerEvents="none"
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    initialRegion={{
                      latitude: selectedAddress.coords.latitude,
                      longitude: selectedAddress.coords.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    region={{
                      latitude: selectedAddress.coords.latitude,
                      longitude: selectedAddress.coords.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: selectedAddress.coords.latitude,
                        longitude: selectedAddress.coords.longitude,
                      }}
                    />
                  </MapView>
                </View>

                {/* Address Details */}
                <View className="p-4">
                  <Text className="text-base font-semibold text-gray-900">
                    {selectedAddress.label}
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1">{selectedAddress.city}</Text>

                  {/* Landmark from Database */}
                  {!requiresInlineAddressDetails && landmark && (
                    <View className="mt-3">
                      <Text className="text-xs text-gray-500 mb-1">{t('checkout.landmark')}</Text>
                      <Text className="text-sm text-gray-700">{landmark}</Text>
                    </View>
                  )}

                  {requiresInlineAddressDetails && (
                    <View ref={inlineAddressSectionRef} className="mt-4 border-t border-gray-100 pt-4">
                      <Text className="text-sm font-semibold text-gray-800 mb-3">
                        {t('checkout.completeAddressDetails')}
                      </Text>
                      <TextInput
                        ref={streetInputRef}
                        value={addressStreet}
                        onChangeText={setAddressStreet}
                        placeholder={t('checkout.streetAddressPlaceholder')}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-3"
                        placeholderTextColor="#9CA3AF"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => cityInputRef.current?.focus()}
                      />
                      <TextInput
                        ref={cityInputRef}
                        value={addressCity}
                        onChangeText={setAddressCity}
                        placeholder={t('checkout.cityPlaceholder')}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-3"
                        placeholderTextColor="#9CA3AF"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => landmarkInputRef.current?.focus()}
                      />
                      <TextInput
                        ref={landmarkInputRef}
                        value={addressLandmark}
                        onChangeText={setAddressLandmark}
                        placeholder={t('checkout.landmarkPlaceholder')}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                        placeholderTextColor="#9CA3AF"
                        returnKeyType="done"
                      />
                      {inlineAddressSubmitAttempted && !hasInlineAddressDetails && (
                        <Text className="text-red-600 text-sm mt-3">{t('checkout.addressDetailsMsg')}</Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => setShowAddressSheet(true)}
                    className="mt-3"
                    activeOpacity={0.7}
                    disabled={isValidatingAddress}
                  >
                    <Text className="text-blue-600 text-sm font-medium">{t('checkout.changeAddress')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View className="p-4">
                <Text className="text-base font-semibold text-gray-900">{t('checkout.selectAddress')}</Text>
                <Text className="text-sm text-gray-500 mt-1">{t('checkout.tapToChoose')}</Text>
                <TouchableOpacity
                  onPress={() => setShowAddressSheet(true)}
                  className="mt-3"
                  activeOpacity={0.7}
                >
                  <Text className="text-blue-600 text-sm font-medium">{t('checkout.changeAddress')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {isValidatingAddress && (
              <View className="p-4 pt-0">
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            )}
          </View>
        </View>

        {/* Delivery Instructions/Contact Details */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            {t('checkout.instructionsTitle')}
          </Text>
          <TextInput
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            placeholder={t('checkout.instructionsPlaceholder')}
            multiline
            numberOfLines={4}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Payment Method Section */}
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <MoneyIcon size={20} color="#111827" />
            <Text className="text-lg font-bold text-gray-900 ml-2">{t('checkout.paymentMethod')}</Text>
          </View>

          <View className="bg-white rounded-xl overflow-hidden border border-gray-200">
            {/* Cash on Delivery */}
            <TouchableOpacity
              onPress={() => setPaymentMethod('cash')}
              className={`flex-row items-center p-4 ${paymentMethod === 'cash' ? 'bg-blue-50' : 'bg-white'
                }`}
              activeOpacity={0.7}
            >
              <View
                className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${paymentMethod === 'cash'
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-gray-300'
                  }`}
              >
                {paymentMethod === 'cash' && (
                  <View className="w-2.5 h-2.5 rounded-full bg-white" />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className={`text-base font-semibold ${paymentMethod === 'cash' ? 'text-blue-900' : 'text-gray-900'
                    }`}
                >
                  {t('checkout.cashOnDelivery')}
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  {t('checkout.cashDescription')}
                </Text>
              </View>
              <Text className="text-2xl">💵</Text>
            </TouchableOpacity>

            {/* Card Payment - Coming Soon */}
            <View className="border-t border-gray-200">
              <View className="flex-row items-center p-4 bg-gray-50 opacity-50">
                <View className="w-5 h-5 rounded-full border-2 border-gray-300 mr-3" />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {t('checkout.cardPayment')}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {t('checkout.comingSoon')}
                  </Text>
                </View>
                <Text className="text-2xl">💳</Text>
              </View>
            </View>

            {/* Mobile Wallet - Coming Soon */}
            <View className="border-t border-gray-200">
              <View className="flex-row items-center p-4 bg-gray-50 opacity-50">
                <View className="w-5 h-5 rounded-full border-2 border-gray-300 mr-3" />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {t('checkout.mobileWallet')}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {t('checkout.walletDescription')}
                  </Text>
                </View>
                <Text className="text-2xl">📱</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Order Summary Section */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('checkout.orderSummary')}</Text>

          {/* Items List */}
          {currentCart.items.map((item, index) => (
            <View
              key={item.id}
              className={`flex-row justify-between py-2 ${index < currentCart.items.length - 1 ? 'border-b border-gray-100' : ''
                }`}
            >
              <View className="flex-1">
                <Text className="text-gray-900 text-base">
                  {item.quantity} × {item.name}
                </Text>
              </View>
              <Text className="text-gray-900 text-base font-semibold ml-2">
                Rs {((item.price_cents * item.quantity) / 100).toFixed(0)}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View className="mt-4 pt-4 border-t border-gray-200">
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
                <Text className="text-green-600 text-base font-semibold">{t('cart.delivery')}</Text>
                <Text className="text-green-600 text-base font-semibold line-through">
                  Rs {totals.deliveryFee.toFixed(0)}
                </Text>
              </View>
            ) : totals.deliveryFee > 0 ? (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600 text-base">{t('cart.delivery')}</Text>
                <Text className="text-gray-900 text-base font-semibold">
                  Rs {totals.deliveryFee.toFixed(0)}
                </Text>
              </View>
            ) : null}

            {/* Total in Order Summary */}
            <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
              <Text className="text-gray-900 text-lg font-bold">{t('cart.total')}</Text>
              {isCalculatingTotals ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text className="text-gray-900 text-lg font-bold">
                  Rs {(totals.total / 100).toFixed(0)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Terms & Conditions - Display Only */}
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
          <Text className="text-gray-600 text-xs text-center">
            {t('checkout.termsText')}{' '}
            <Text className="text-gray-900 font-semibold">{t('checkout.termsLink')}</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Footer with Total and Place Order Button */}
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
        {/* Total */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-gray-900 text-xl font-bold">{t('cart.total')}</Text>
          <Text className="text-gray-900 text-xl font-bold">
            {isCalculatingTotals ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              `Rs ${(totals.total / 100).toFixed(0)}`
            )}
          </Text>
        </View>

        {/* Place Order Button */}
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={!canPlaceOrder}
          className={`rounded-2xl py-4 px-6 items-center justify-center ${!canPlaceOrder
            ? 'bg-gray-300'
            : 'bg-blue-600'
            }`}
          activeOpacity={!canPlaceOrder ? 1 : 0.8}
        >
          <View className="flex-row items-center justify-center">
            {(isPlacingOrder || placeOrderMutation.isLoading) && (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
            <Text className="text-white font-bold text-lg ml-2">
              {isPlacingOrder || placeOrderMutation.isLoading ? t('checkout.placingOrder') : t('checkout.placeOrder')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Address Selection Bottom Sheet */}
      <AddressSelectionBottomSheet
        visible={showAddressSheet}
        onClose={() => setShowAddressSheet(false)}
        onSelectAddress={handleSelectAddress}
      />
    </View>
  );
}

