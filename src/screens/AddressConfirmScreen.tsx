import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Platform } from 'react-native';
// MapView resolver: single-source expo-maps only
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useLocationSelection } from '../context/LocationContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ConfirmRouteProp = RouteProp<RootStackParamList, 'AddressConfirm'>;

export default function AddressConfirmScreen() {
  function getMapView(): any | null {
    try {
      const m = require('expo-maps');
      if (typeof m?.MapView === 'function') return m.MapView;
      if (typeof m?.default === 'function') return m.default;
      return null;
    } catch {}
    return null;
  }
  const MapViewComp = getMapView();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfirmRouteProp>();
  const { setSelectedAddress } = useLocationSelection();
  const mapRef = useRef<any>(null);

  const initialCoords = route.params.coords;
  const initialLabel = route.params.label;
  const initialAddress = route.params.address;

  const [pinCoords, setPinCoords] = useState(initialCoords);
  const [addressText, setAddressText] = useState(initialAddress || '');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reverse geocode initial location
    reverseGeocodeLocation(initialCoords);
  }, []);

  const reverseGeocodeLocation = async (coords: { latitude: number; longitude: number }) => {
    setIsLoadingAddress(true);
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (result && result.length > 0) {
        const addr = result[0];
        const fullAddress = [
          addr.name,
          addr.street,
          addr.district,
          addr.city,
          addr.region,
        ]
          .filter(Boolean)
          .join(', ');
        
        setAddressText(fullAddress || 'Selected location');
        
        console.log('📍 Reverse Geocoded Address:', {
          coords: coords,
          fullAddress: fullAddress,
          details: addr,
        });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleMapPress = (event: any) => {
    const newCoords = event?.nativeEvent?.coordinate;
    if (!newCoords) return;
    setPinCoords(newCoords);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reverseGeocodeLocation(newCoords), 250);
  };

  const handleRecenter = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setPinCoords(userCoords);
      reverseGeocodeLocation(userCoords);

      mapRef.current?.animateToRegion({
        ...userCoords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleConfirm = () => {
    console.log('✅ Confirmed Address:', {
      label: initialLabel || addressText.split(',')[0] || 'Selected Address',
      city: addressText.split(',').slice(-2)[0]?.trim() || 'Unknown',
      coords: pinCoords,
      fullAddress: addressText,
    });

    setSelectedAddress({
      label: initialLabel || addressText.split(',')[0] || 'Selected Address',
      city: addressText.split(',').slice(-2)[0]?.trim() || 'Unknown',
      coords: pinCoords,
      isCurrent: false,
    });

    // Navigate back to home (dismiss both screens)
    navigation.navigate('Home');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleClose = () => {
    navigation.navigate('Home');
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Full Screen Map */}
      {MapViewComp ? (
        <MapViewComp
          ref={mapRef}
          className="flex-1"
          initialRegion={{
            ...pinCoords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
          onRegionChangeComplete={(region: any) => {
            if (region?.latitude && region?.longitude) {
              const c = { latitude: region.latitude, longitude: region.longitude };
              setPinCoords(c);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => reverseGeocodeLocation(c), 250);
            }
          }}
          showsUserLocation
          showsMyLocationButton={false}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-gray-100">
          <Text className="text-gray-500">Map unavailable</Text>
        </View>
      )}

      {/* Centered Pink Pin Overlay */}
      <View className="absolute left-1/2 top-1/2 -ml-4 -mt-8 pointer-events-none">
        <Text className="text-4xl">📍</Text>
      </View>

      {/* Tooltip above pin */}
      <View className="absolute top-1/3 left-0 right-0 items-center pointer-events-none">
        <View className="bg-white px-4 py-2 rounded-full shadow-lg">
          <Text className="text-sm font-semibold text-gray-800">
            Is this your building's entrance?
          </Text>
        </View>
      </View>

      {/* Close Button */}
      <TouchableOpacity
        className="absolute top-12 left-4 w-10 h-10 bg-white rounded-full items-center justify-center shadow-lg"
        onPress={handleClose}
        activeOpacity={0.7}
      >
        <Text className="text-xl text-gray-700">✕</Text>
      </TouchableOpacity>

      {/* Recenter Button */}
      <TouchableOpacity
        className="absolute bottom-40 right-4 w-12 h-12 bg-white rounded-full items-center justify-center shadow-lg"
        onPress={handleRecenter}
        activeOpacity={0.7}
      >
        <Text className="text-xl">🎯</Text>
      </TouchableOpacity>

      {/* Bottom Floating Card */}
      <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6">
        {/* Content Row */}
        <View className="flex-row items-center mb-4">
          {/* Text Content */}
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900 mb-1">
              Apne rider ko aapko dhoondhne mein madad karen!
            </Text>
            <Text className="text-sm text-gray-600">
              For Smooth Delivery place the pin on your building entrance
            </Text>
            {isLoadingAddress ? (
              <Text className="text-xs text-pink-500 mt-2">Loading address...</Text>
            ) : (
              <Text className="text-xs text-gray-500 mt-2" numberOfLines={2}>
                {addressText}
              </Text>
            )}
          </View>

          {/* Panda Mascot */}
          <View className="ml-4">
            <Text className="text-6xl">🐼</Text>
          </View>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-white border-2 border-pink-500 rounded-xl py-3.5 items-center"
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Text className="text-pink-500 font-bold text-base">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-pink-500 rounded-xl py-3.5 items-center"
            onPress={handleConfirm}
            activeOpacity={0.7}
          >
            <Text className="text-white font-bold text-base">Confirm location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

