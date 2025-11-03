import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import * as addressService from '../../services/consumer/addressService';
import EditIcon from '../../icons/EditIcon';
import DeleteIcon from '../../icons/DeleteIcon';
import AddressListSkeleton from '../../skeleton/AddressListSkeleton';

type ConsumerAddressManagementScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ConsumerAddressManagementScreen() {
  const [addresses, setAddresses] = React.useState<addressService.ConsumerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = React.useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<ConsumerAddressManagementScreenNavigationProp>();

  const fetchAddresses = React.useCallback(async () => {
    if (!user) return;
    setLoadingAddresses(true);
    try {
      const { data, error } = await addressService.getUserAddresses();
      if (error) {
        console.log('Error fetching addresses:', error);
        Alert.alert('Error', error.message || 'Failed to load addresses');
      } else {
        setAddresses(data || []);
      }
    } catch (err) {
      console.log('Error fetching addresses:', err);
      Alert.alert('Error', 'Failed to load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  }, [user]);

  // Fetch addresses when screen is focused and user is logged in
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchAddresses();
      } else {
        setAddresses([]);
      }
    }, [user, fetchAddresses])
  );

  const handleDeleteAddress = (address: addressService.ConsumerAddress) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete this address?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await addressService.deleteAddress(address.id);
              if (error) {
                Alert.alert('Error', error.message || 'Failed to delete address');
              } else {
                // Refresh addresses after deletion
                fetchAddresses();
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!user) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 items-center justify-center mr-3"
          >
            <Text className="text-2xl text-gray-900">←</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 flex-1">Addresses</Text>
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-gray-500 text-center mb-4">
            Please Sign Up / Login to manage your addresses
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            className="bg-blue-600 rounded-xl items-center justify-center py-3 px-6"
            onPress={() => navigation.navigate('Login', { returnTo: 'Home' })}
          >
            <Text className="text-white text-base font-bold">Sign Up / Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          className="w-10 h-10 items-center justify-center mr-3"
        >
          <Text className="text-2xl text-gray-900">←</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Addresses</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {loadingAddresses ? (
          <AddressListSkeleton count={3} />
        ) : addresses.length === 0 ? (
          <View className="px-4 mt-6">
            <View className="bg-white rounded-2xl p-6 items-center">
              <Text className="text-gray-500 text-center">No addresses saved yet</Text>
              <Text className="text-gray-400 text-sm text-center mt-1">Add your first address to get started</Text>
            </View>
          </View>
        ) : (
          <View className="px-4 mt-4">
            <View className="bg-white rounded-2xl overflow-hidden">
              {addresses.map((address, index) => (
                <React.Fragment key={address.id}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AddressSearch', { address })}
                    activeOpacity={0.7}
                    className="px-4 py-4"
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        {address.title && (
                          <View className="flex-row items-center mb-1">
                            <Text className="text-xl mr-2">
                              {address.title === 'home' ? '🏠' : '🏢'}
                            </Text>
                            <Text className="text-gray-500 text-xs font-medium uppercase">
                              {address.title}
                            </Text>
                          </View>
                        )}
                        <Text className="text-gray-900 text-base font-semibold" numberOfLines={2}>
                          {address.street_address}
                        </Text>
                        {address.city && (
                          <Text className="text-gray-600 text-sm mt-1">
                            {address.city}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            navigation.navigate('AddressSearch', { address });
                          }}
                          activeOpacity={0.7}
                          className="w-10 h-10 items-center justify-center bg-blue-50 rounded-lg"
                        >
                          <EditIcon size={20} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(address);
                          }}
                          activeOpacity={0.7}
                          className="w-10 h-10 items-center justify-center bg-red-50 rounded-lg"
                        >
                          <DeleteIcon size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {index < addresses.length - 1 && <View className="h-px bg-gray-200 mx-4" />}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Add New Address Button at the end */}
        <View className="px-4 mt-4">
          <TouchableOpacity
            onPress={() => navigation.navigate('AddressSearch', {})}
            activeOpacity={0.8}
            className="bg-blue-600 rounded-2xl items-center justify-center py-4"
          >
            <Text className="text-white text-base font-bold">+ Add New Address</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

