import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Config from 'react-native-config';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../context/CartContext';
import { useLocationSelection } from '../../context/LocationContext';
import { calculateDistance, calculateTotalDeliveryFee, fetchDeliveryLogic } from '../../services/merchant/deliveryLogicService';
import { validateDeliveryAddress } from '../../services/consumer/shopService';
import * as addressService from '../../services/consumer/addressService';
import { usePlaceOrder } from '../../hooks/consumer/useOrders';
import { PaymentMethod } from '../../types/orders';
import BackIcon from '../../icons/BackIcon';
import PinMarker from '../../icons/PinMarker';
import MoneyIcon from '../../icons/MoneyIcon';
import AddressSelectionBottomSheet from '../../components/consumer/AddressSelectionBottomSheet';

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
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { shopId } = route.params;
  const insets = useSafeAreaInsets();
  const { getShopCart, deleteShopCart } = useCart();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();

  const currentCart = getShopCart(shopId);
  
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [isCalculatingTotals, setIsCalculatingTotals] = useState(true);
  const [addressId, setAddressId] = useState<string | undefined>(undefined);
  const [landmark, setLandmark] = useState<string | null>(null);
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

  // Initialize or save address when component mounts
  useEffect(() => {
    const initializeAddress = async () => {
      if (!selectedAddress) return;

      // If selectedAddress has an addressId, use it
      if ('addressId' in selectedAddress && selectedAddress.addressId) {
        setAddressId(selectedAddress.addressId);
        return;
      }

      // If using current location without saved address, save it as a temporary address
      if (selectedAddress.isCurrent && selectedAddress.coords) {
        try {
          // Save the current location as an address
          const { data: newAddress, error } = await addressService.createAddress({
            street_address: selectedAddress.label || 'Current Location',
            city: selectedAddress.city || 'Unknown',
            region: null,
            latitude: selectedAddress.coords.latitude,
            longitude: selectedAddress.coords.longitude,
            landmark: null,
            formatted_address: selectedAddress.label,
          });

          if (!error && newAddress) {
            setAddressId(newAddress.id);
            console.log('Auto-saved current location as address:', newAddress.id);
          } else {
            console.error('Error saving address:', error);
          }
        } catch (error) {
          console.error('Error auto-saving address:', error);
        }
      }
    };

    initializeAddress();
  }, [selectedAddress]);

  // Calculate totals when address or cart changes
  // This handles all edge cases including:
  // - Distance tiering changes (auto or custom)
  // - Free delivery threshold changes (if user moves outside free delivery radius)
  // - Small order surcharge changes based on order value
  const calculateTotals = useCallback(async () => {
    if (!currentCart || !selectedAddress) {
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
              setLandmark(address.landmark);
            }
          }
        } catch (error) {
          console.error('Error fetching landmark:', error);
        }
      } else {
        setLandmark(null);
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
  }) => {
    setIsValidatingAddress(true);

    try {
      // Validate if address is within delivery zone
      const { data, error } = await validateDeliveryAddress(
        shopId,
        address.coords.latitude,
        address.coords.longitude
      );

      if (error) {
        Alert.alert('Validation Error', 'Could not validate delivery address');
        setIsValidatingAddress(false);
        return;
      }

      if (!data?.isWithinDeliveryZone) {
        Alert.alert(
          'Delivery Unavailable',
          'This address is outside the shop\'s delivery zone. Please select a different address.',
          [{ text: 'OK' }]
        );
        setIsValidatingAddress(false);
        return;
      }

      // Address is valid, set it and recalculate delivery fees
      setSelectedAddress(address);
      setAddressId(address.addressId);
      
      // Totals will automatically recalculate via useEffect
      // This handles edge cases like:
      // - Moving from free delivery zone to paid delivery zone
      // - Distance tier changes (different delivery fees based on distance)
      // - Any changes in delivery logic
    } catch (error) {
      console.error('Error validating address:', error);
      Alert.alert('Error', 'Failed to validate address');
    } finally {
      setIsValidatingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select a delivery address');
      return;
    }

    if (isCalculatingTotals) {
      Alert.alert('Please Wait', 'Still calculating delivery fees...');
      return;
    }

    if (!addressId) {
      Alert.alert('Address Error', 'Please select a saved address or save your current location first.');
      return;
    }

    // By tapping Place Order, user agrees to terms & conditions
    try {
      const orderItems = currentCart.items.map(item => ({
        merchant_item_id: item.id,
        quantity: item.quantity,
      }));

      const response = await placeOrderMutation.mutateAsync({
        shop_id: shopId,
        consumer_address_id: addressId,
        items: orderItems,
        payment_method: paymentMethod,
        special_instructions: deliveryInstructions || undefined,
      });

      if (response.success && response.order) {
        // Clear cart for this shop
        await deleteShopCart(shopId);
        
        // Navigate to order status screen
        navigation.replace('OrderStatus', { orderId: response.order.id });
      } else {
        Alert.alert('Order Failed', response.message || 'Could not place your order. Please try again.');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please check your connection and try again.');
    }
  };

  if (!currentCart || currentCart.items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">🛒</Text>
          <Text className="text-gray-900 text-lg font-semibold mb-2">Cart is empty</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 bg-blue-600 px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Generate Google Static Maps URL
  const getStaticMapUrl = (coords: { latitude: number; longitude: number }) => {
    const googleApiKey = Config.GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';
    const lat = coords.latitude;
    const lon = coords.longitude;
    const zoom = 16; // Street-level zoom
    const size = '400x150'; // Width x Height
    const markerColor = '0x3B82F6'; // Blue marker
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=color:${markerColor}%7C${lat},${lon}&key=${googleApiKey}`;
  };

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
            <Text className="text-gray-900 text-lg font-bold">Checkout</Text>
            <Text className="text-gray-500 text-sm">{currentCart.shopName}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Delivery Address Section */}
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg font-bold text-gray-900 mr-2">📍</Text>
            <Text className="text-lg font-bold text-gray-900">Delivery Address</Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowAddressSheet(true)}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            activeOpacity={0.7}
            disabled={isValidatingAddress}
          >
            {selectedAddress && selectedAddress.coords ? (
              <>
                {/* Map Preview */}
                <View style={{ height: 150, position: 'relative' }}>
                  <Image
                    source={{ uri: getStaticMapUrl(selectedAddress.coords) }}
                    style={{ width: '100%', height: 150 }}
                    resizeMode="cover"
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      marginLeft: -16,
                      marginTop: -30,
                      shadowColor: '#000',
                      shadowOpacity: 0.25,
                      shadowRadius: 3.5,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 6,
                    }}
                    pointerEvents="none"
                  >
                    <PinMarker size={32} color="#3B82F6" />
                  </View>
                </View>
                
                {/* Address Details */}
                <View className="p-4">
                  <Text className="text-base font-semibold text-gray-900">
                    {selectedAddress.label}
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1">{selectedAddress.city}</Text>
                  
                  {/* Landmark from Database */}
                  {landmark && (
                    <View className="mt-3">
                      <Text className="text-xs text-gray-500 mb-1">Landmark</Text>
                      <Text className="text-sm text-gray-700">{landmark}</Text>
                    </View>
                  )}
                  
                  <Text className="text-blue-600 text-sm font-medium mt-3">Change Address</Text>
                </View>
              </>
            ) : (
              <View className="p-4">
                <Text className="text-base font-semibold text-gray-900">Select Address</Text>
                <Text className="text-sm text-gray-500 mt-1">Tap to choose delivery address</Text>
              </View>
            )}
            {isValidatingAddress && (
              <View className="p-4 pt-0">
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Delivery Instructions/Contact Details */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Delivery instructions/contact details
          </Text>
          <TextInput
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            placeholder="Note to rider, contact details, or any special instructions"
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
            <Text className="text-lg font-bold text-gray-900 ml-2">Payment Method</Text>
          </View>

          <View className="bg-white rounded-xl overflow-hidden border border-gray-200">
            {/* Cash on Delivery */}
            <TouchableOpacity
              onPress={() => setPaymentMethod('cash')}
              className={`flex-row items-center p-4 ${
                paymentMethod === 'cash' ? 'bg-blue-50' : 'bg-white'
              }`}
              activeOpacity={0.7}
            >
              <View
                className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                  paymentMethod === 'cash'
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
                  className={`text-base font-semibold ${
                    paymentMethod === 'cash' ? 'text-blue-900' : 'text-gray-900'
                  }`}
                >
                  Cash on Delivery
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  Pay with cash when your order arrives
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
                    Card Payment
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    Coming soon
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
                    Mobile Wallet
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    JazzCash, Easypaisa - Coming soon
                  </Text>
                </View>
                <Text className="text-2xl">📱</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Order Summary Section */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Order Summary</Text>

          {/* Items List */}
          {currentCart.items.map((item, index) => (
            <View
              key={item.id}
              className={`flex-row justify-between py-2 ${
                index < currentCart.items.length - 1 ? 'border-b border-gray-100' : ''
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
              <Text className="text-gray-600 text-base">Subtotal</Text>
              <Text className="text-gray-900 text-base font-semibold">
                Rs {(totals.subtotal / 100).toFixed(0)}
              </Text>
            </View>

            {totals.surcharge > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600 text-base">Small order surcharge</Text>
                <Text className="text-gray-900 text-base font-semibold">
                  Rs {totals.surcharge.toFixed(0)}
                </Text>
              </View>
            )}

            {totals.freeDeliveryApplied ? (
              <View className="flex-row justify-between mb-2">
                <Text className="text-green-600 text-base font-semibold">Delivery</Text>
                <Text className="text-green-600 text-base font-semibold line-through">
                  Rs {totals.deliveryFee.toFixed(0)}
                </Text>
              </View>
            ) : totals.deliveryFee > 0 ? (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600 text-base">Delivery</Text>
                <Text className="text-gray-900 text-base font-semibold">
                  Rs {totals.deliveryFee.toFixed(0)}
                </Text>
              </View>
            ) : null}

            {/* Total in Order Summary */}
            <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
              <Text className="text-gray-900 text-lg font-bold">Total</Text>
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
            By placing this order, you agree to all{' '}
            <Text className="text-gray-900 font-semibold">terms & conditions</Text>
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
          <Text className="text-gray-900 text-xl font-bold">Total</Text>
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
          disabled={!selectedAddress || isValidatingAddress || isCalculatingTotals || placeOrderMutation.isPending}
          className={`rounded-2xl py-4 px-6 items-center justify-center ${
            !selectedAddress || isValidatingAddress || isCalculatingTotals || placeOrderMutation.isPending
              ? 'bg-gray-300'
              : 'bg-blue-600'
          }`}
          activeOpacity={!selectedAddress || isValidatingAddress || isCalculatingTotals || placeOrderMutation.isPending ? 1 : 0.8}
        >
          {placeOrderMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
          <Text className="text-white font-bold text-lg">Place Order</Text>
          )}
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

