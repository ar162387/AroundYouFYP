import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLocationSelection } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import * as addressService from '../../services/consumer/addressService';
import AddressListSkeleton from '../../skeleton/AddressListSkeleton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AddressSelectionBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (address: {
    label: string;
    city: string;
    coords: { latitude: number; longitude: number };
    isCurrent: boolean;
    addressId?: string;
  }) => void;
};

export default function AddressSelectionBottomSheet({
  visible,
  onClose,
  onSelectAddress,
}: AddressSelectionBottomSheetProps) {
  const navigation = useNavigation<NavigationProp>();
  const { selectedAddress } = useLocationSelection();
  const { user } = useAuth();
  const [savedAddresses, setSavedAddresses] = useState<addressService.ConsumerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Fetch saved addresses when modal opens and user is authenticated
  useEffect(() => {
    if (visible && user) {
      const timer = setTimeout(() => {
        fetchSavedAddresses();
      }, 300);
      return () => clearTimeout(timer);
    } else if (!user) {
      setSavedAddresses([]);
    }
  }, [visible, user]);

  const fetchSavedAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const { data, error: fetchError } = await addressService.getUserAddresses();
      if (!fetchError && data) {
        setSavedAddresses(data);
      } else if (fetchError) {
        console.log('Error fetching addresses:', fetchError);
      }
    } catch (err) {
      console.log('Error fetching addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSelectSavedAddress = (address: addressService.ConsumerAddress) => {
    const coords = {
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };
    
    onSelectAddress({
      label: address.street_address,
      city: address.city,
      coords,
      isCurrent: false,
      addressId: address.id,
    });
    onClose();
  };

  // Group addresses: with titles first, then without titles
  const addressesWithTitles = savedAddresses.filter((addr) => addr.title);
  const addressesWithoutTitles = savedAddresses.filter((addr) => !addr.title);

  function handleAddNewAddress() {
    onClose();
    setTimeout(() => {
      navigation.navigate('AddressSearch', { address: undefined });
    }, 300);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-2xl" style={{ maxHeight: '80%' }}>
          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
            <View className="p-4 pb-6">
              {/* Grabber */}
              <View className="items-center mb-3">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              {/* Title */}
              <Text className="text-lg font-semibold mb-4">Choose delivery address</Text>

              {/* Current selection card */}
              {selectedAddress && (
                <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                  <Text className="text-xs text-blue-600 font-semibold mb-1">CURRENT ADDRESS</Text>
                  <Text className="text-base font-semibold text-gray-900">{selectedAddress.label}</Text>
                  <Text className="text-sm text-gray-600">{selectedAddress.city}</Text>
                </View>
              )}

              {/* Divider */}
              <View className="h-px bg-gray-200 my-2" />

              {/* Saved Addresses List */}
              {user && (
                <>
                  {loadingAddresses ? (
                    <>
                      <AddressListSkeleton count={2} showTitle={true} />
                      <AddressListSkeleton count={1} showTitle={false} />
                    </>
                  ) : (
                    <>
                      {/* Saved Addresses with Titles */}
                      {addressesWithTitles.length > 0 && (
                        <View className="mt-2">
                          {addressesWithTitles.map((address) => (
                            <TouchableOpacity
                              key={address.id}
                              className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2"
                              activeOpacity={0.7}
                              onPress={() => handleSelectSavedAddress(address)}
                            >
                              <View className="p-3">
                                <View className="flex-row items-center mb-1">
                                  <Text className="text-base mr-2">
                                    {address.title === 'home' ? '🏠' : '🏢'}
                                  </Text>
                                  <Text className="text-sm font-semibold text-gray-700 capitalize">
                                    {address.title}
                                  </Text>
                                </View>
                                <Text className="text-base font-semibold text-gray-900">
                                  {address.street_address}
                                </Text>
                                <Text className="text-sm text-gray-600">{address.city}</Text>
                                {address.landmark && (
                                  <Text className="text-xs text-gray-500 mt-1">{address.landmark}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Saved Addresses without Titles */}
                      {addressesWithoutTitles.length > 0 && (
                        <View className="mt-2">
                          {addressesWithoutTitles.map((address) => (
                            <TouchableOpacity
                              key={address.id}
                              className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2"
                              activeOpacity={0.7}
                              onPress={() => handleSelectSavedAddress(address)}
                            >
                              <View className="p-3">
                                <Text className="text-base font-semibold text-gray-900">
                                  {address.street_address}
                                </Text>
                                <Text className="text-sm text-gray-600">{address.city}</Text>
                                {address.landmark && (
                                  <Text className="text-xs text-gray-500 mt-1">{address.landmark}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Add New Address Option */}
              <TouchableOpacity
                className="flex-row items-center py-3 mt-2"
                activeOpacity={0.7}
                onPress={handleAddNewAddress}
              >
                <Text className="text-xl mr-3">➕</Text>
                <Text className="text-base font-medium">Add New Address</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

