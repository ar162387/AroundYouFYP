import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useUserLocation } from '../hooks/useUserLocation';
import { useLocationSelection } from '../context/LocationContext';

type AddressBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export default function AddressBottomSheet({ visible, onClose }: AddressBottomSheetProps) {
  const { addressLine, placeLabel, city, coords, loading, error } = useUserLocation();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();

  const isUsingCurrent = Boolean(selectedAddress?.isCurrent);
  const canUseCurrent = Boolean(coords) && !loading && !error;

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
    // Placeholder: details to be implemented later
    // Do NOT change selectedAddress yet to avoid flipping UI state
    onClose();
  }

  const cardLabel = selectedAddress?.label || placeLabel || addressLine || 'Select your address';
  const cardCity = selectedAddress?.city || city || '';
  const previewCoords = selectedAddress?.coords || coords || null;
  const androidMapsKey = (Constants as any)?.expoConfig?.android?.config?.googleMaps?.apiKey as string | undefined;
  const canRenderAndroidMap = Platform.OS !== 'android' || Boolean(androidMapsKey);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-2xl p-4">
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
              <Text className="text-xl mr-3">📍</Text>
              <Text className="text-base font-medium">
                {canUseCurrent ? 'Use my current location' : 'Use my current location (Location unavailable)'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View className="h-px bg-gray-200 my-2" />

          {/* 3. Selected Address Card with mini map preview */}
          <View className="bg-white border border-pink-200 rounded-xl overflow-hidden mb-3">
            {previewCoords && canRenderAndroidMap ? (
              <View className="h-28">
                {(() => {
                  // Lazy-load react-native-maps only when allowed to render
                  const { default: MapView, Marker } = require('react-native-maps');
                  return (
                    <MapView
                  style={{ flex: 1 }}
                  initialRegion={{
                    latitude: previewCoords.latitude,
                    longitude: previewCoords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  zoomEnabled={false}
                    >
                      <Marker
                        coordinate={{ latitude: previewCoords.latitude, longitude: previewCoords.longitude }}
                        pinColor="#ec4899"
                      />
                    </MapView>
                  );
                })()}
              </View>
            ) : (
              <View className="h-28 bg-pink-50 items-center justify-center">
                <Text className="text-2xl">📍</Text>
                <Text className="text-pink-500 text-xs mt-1">
                  {previewCoords && !canRenderAndroidMap ? 'Map preview unavailable (API key missing)' : 'Map preview'}
                </Text>
              </View>
            )}
            <View className="p-3">
              <Text className="text-base font-semibold">{cardLabel}</Text>
              <Text className="text-gray-600">{cardCity}</Text>
            </View>
          </View>

          {/* 4. Add New Address Option */}
          <TouchableOpacity
            className="flex-row items-center py-3"
            activeOpacity={0.7}
            onPress={handleAddNewAddress}
          >
            <Text className="text-xl mr-3">➕</Text>
            <Text className="text-base font-medium">Add New Address</Text>
          </TouchableOpacity>

          {/* Footer spacing */}
          <View className="mt-2" />
        </View>
      </View>
    </Modal>
  );
}


