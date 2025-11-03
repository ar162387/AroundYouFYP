import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import * as merchantService from '../../services/merchant/merchantService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MerchantRegistrationSurveyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [selectedShopType, setSelectedShopType] = useState<merchantService.ShopType | null>(null);
  const [selectedNumberOfShops, setSelectedNumberOfShops] = useState<merchantService.NumberOfShops | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const shopTypes: { value: merchantService.ShopType; label: string }[] = [
    { value: 'grocery', label: 'Grocery' },
    { value: 'meat', label: 'Meat' },
    { value: 'vegetable', label: 'Vegetable' },
    { value: 'mart', label: 'Mart' },
    { value: 'other', label: 'Other' },
  ];

  const numberOfShopsOptions: { value: merchantService.NumberOfShops; label: string }[] = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3+', label: '3+' },
  ];

  const handleCreateAccount = async () => {
    if (!selectedShopType || !selectedNumberOfShops || !user) {
      Alert.alert('Missing Information', 'Please select both shop type and number of shops.');
      return;
    }

    setIsCreating(true);
    try {
      const { merchant, error } = await merchantService.createMerchantAccount(user.id, {
        shop_type: selectedShopType,
        number_of_shops: selectedNumberOfShops,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // Navigate to merchant dashboard
      navigation.replace('MerchantDashboard');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create merchant account');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Merchant Registration</Text>
        <Text className="text-gray-500 text-sm mt-1">Tell us about your business</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Shop Type Section */}
        <View className="px-4 mt-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Type of Shop</Text>
          <View>
            {shopTypes.map((type, index) => (
              <TouchableOpacity
                key={type.value}
                activeOpacity={0.7}
                onPress={() => setSelectedShopType(type.value)}
                className={`p-4 rounded-xl border-2 ${
                  selectedShopType === type.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white'
                } ${index > 0 ? 'mt-2' : ''}`}
              >
                <Text
                  className={`font-medium ${
                    selectedShopType === type.value ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Number of Shops Section */}
        <View className="px-4 mt-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Number of Shops</Text>
          <View className="flex-row">
            {numberOfShopsOptions.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.7}
                onPress={() => setSelectedNumberOfShops(option.value)}
                className={`flex-1 p-4 rounded-xl border-2 items-center ${
                  selectedNumberOfShops === option.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white'
                } ${index > 0 ? 'ml-3' : ''}`}
              >
                <Text
                  className={`font-medium ${
                    selectedNumberOfShops === option.value ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Create Account Button */}
        <View className="px-4 mt-8">
          <TouchableOpacity
            activeOpacity={0.8}
            className="w-full bg-blue-600 rounded-xl items-center justify-center py-4"
            onPress={handleCreateAccount}
            disabled={isCreating || !selectedShopType || !selectedNumberOfShops}
            style={{
              opacity: isCreating || !selectedShopType || !selectedNumberOfShops ? 0.5 : 1,
            }}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white text-base font-bold">Create Merchant Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

