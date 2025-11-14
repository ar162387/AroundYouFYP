import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, Platform, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Config from 'react-native-config';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import PinMarker from '../../icons/PinMarker';
import LocationMarkerIcon from '../../icons/LocationMarkerIcon';
import type { RootStackParamList } from '../../navigation/types';
import * as addressService from '../../services/consumer/addressService';
import AddressListSkeleton from '../../skeleton/AddressListSkeleton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AddressBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export default function AddressBottomSheet({ visible, onClose }: AddressBottomSheetProps) {
  const navigation = useNavigation<NavigationProp>();
  const { addressLine, placeLabel, city, coords, loading, error } = useUserLocation();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();
  const { user } = useAuth();
  const [savedAddresses, setSavedAddresses] = useState<addressService.ConsumerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  const isUsingCurrent = Boolean(selectedAddress?.isCurrent);
  const canUseCurrent = Boolean(coords) && !loading && !error;



  // Fetch saved addresses when modal opens and user is authenticated
  useEffect(() => {
    if (visible && user) {
      // Small delay to ensure navigation is complete if coming from address search
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
    console.log('Selected address coords:', coords, 'from address:', address);
    setSelectedAddress({
      label: address.street_address,
      city: address.city,
      coords,
      isCurrent: false,
    });
    onClose();
  };

  // Group addresses: with titles first, then without titles
  const addressesWithTitles = savedAddresses.filter((addr) => addr.title);
  const addressesWithoutTitles = savedAddresses.filter((addr) => !addr.title);

  function handleUseCurrentLocation() {
    if ((!placeLabel && !addressLine) || !coords) return;
    setSelectedAddress({
      label: placeLabel || (addressLine?.split(',')[1]?.trim() || addressLine || 'Current location'),
      city: city || addressLine?.split(',').slice(-2)[0]?.trim() || 'Unknown',
      coords,
      isCurrent: true,
    });
    onClose();
  }

  function handleAddNewAddress() {
    onClose();
    // Navigate to address search screen after closing the modal
    setTimeout(() => {
      navigation.navigate('AddressSearch', { address: undefined });
    }, 300);
  }

  const cardLabel = selectedAddress?.label || placeLabel || addressLine || 'Select your address';
  const cardCity = selectedAddress?.city || city || '';
  const previewCoords = selectedAddress?.coords || coords || null;
  
  // Generate Google Static Maps URL
  const getStaticMapUrl = (coords: { latitude: number; longitude: number }) => {
    const googleApiKey = Config.GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';
    const lat = coords.latitude;
    const lon = coords.longitude;
    const zoom = 16; // Street-level zoom
    const size = '400x112'; // Width x Height
    const markerColor = '0x3B82F6'; // Blue marker
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=color:${markerColor}%7C${lat},${lon}&key=${googleApiKey}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View 
          className="bg-white rounded-t-2xl"
          style={{ maxHeight: '80%' }}
        >
          <ScrollView 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <View className="p-4 pb-6">
          {/* Grabber */}
          <View className="items-center mb-3">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </View>

          {/* Title */}
          <Text className="text-lg font-semibold mb-4">Choose delivery address</Text>

          {/* 2. Current Location Option */}
          {!isUsingCurrent && (
            <TouchableOpacity
              className={`flex-row items-center py-3 ${canUseCurrent ? '' : 'opacity-60'}`}
              activeOpacity={0.7}
              onPress={handleUseCurrentLocation}
              disabled={!canUseCurrent}
            >
              <View className="mr-3">
                <LocationMarkerIcon size={24} color="#2563EB" innerColor="#FFFFFF" accentColor="rgba(255,255,255,0.25)" />
              </View>
              <Text className="text-base font-medium">
                {canUseCurrent ? 'Use my current location' : 'Use my current location (Location unavailable)'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View className="h-px bg-gray-200 my-2" />

          {/* 3. Selected Address Card with mini map preview */}
          <View className="bg-white border border-pink-200 rounded-xl overflow-hidden mb-3">
            {previewCoords ? (
              <View style={{ height: 112, position: 'relative' }}>
                <Image
                  source={{ uri: getStaticMapUrl(previewCoords) }}
                  style={{ width: '100%', height: 112 }}
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
            ) : (
              <View className="h-28 bg-pink-50 items-center justify-center">
                <LocationMarkerIcon size={32} color="#DB2777" innerColor="#FFFFFF" accentColor="rgba(255,255,255,0.35)" />
                <Text className="text-pink-500 text-xs mt-1">Map preview</Text>
              </View>
            )}
            <View className="p-3">
              <Text className="text-base font-semibold">{cardLabel}</Text>
              <Text className="text-gray-600">{cardCity}</Text>
            </View>
          </View>

          {/* 5. Saved Addresses List - only show if user is authenticated */}
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
                            <Text className="text-base font-semibold text-gray-900">{address.street_address}</Text>
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
                            <Text className="text-base font-semibold text-gray-900">{address.street_address}</Text>
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

          {/* 4. Add New Address Option */}
          <TouchableOpacity
            className="flex-row items-center py-3"
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


