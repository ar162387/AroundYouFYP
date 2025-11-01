import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import * as Location from 'expo-location';
// Single-source maps from expo-maps with a simple validity guard
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useUserLocation } from '../hooks/useUserLocation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SearchResult = {
  id: string;
  name: string;
  address: string;
  coords: { latitude: number; longitude: number };
};

export default function AddressSearchScreen() {
  function getExpoMapView(): any | null {
    try {
      const m = require('expo-maps');
      if (typeof m?.MapView === 'function') return m.MapView;
      if (typeof m?.default === 'function') return m.default;
      return null;
    } catch {}
    return null;
  }
  const MapViewComp = getExpoMapView();
  const navigation = useNavigation<NavigationProp>();
  const { coords: userCoords } = useUserLocation();
  const mapRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: userCoords?.latitude || 31.5204,
    longitude: userCoords?.longitude || 74.3587,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    if (userCoords) {
      setMapRegion({
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [userCoords]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      // Use Expo Location geocoding
      const results = await Location.geocodeAsync(query);
      
      const searchResultsData: SearchResult[] = await Promise.all(
        results.slice(0, 5).map(async (result, index) => {
          // Reverse geocode to get address
          let addressText = query;
          try {
            const reverseGeocode = await Location.reverseGeocodeAsync({
              latitude: result.latitude,
              longitude: result.longitude,
            });
            
            if (reverseGeocode && reverseGeocode.length > 0) {
              const addr = reverseGeocode[0];
              addressText = [
                addr.name,
                addr.street,
                addr.district,
                addr.city,
                addr.region,
              ]
                .filter(Boolean)
                .join(', ');
            }
          } catch (err) {
            console.log('Reverse geocode failed:', err);
          }

          return {
            id: `${result.latitude}-${result.longitude}-${index}`,
            name: query,
            address: addressText,
            coords: {
              latitude: result.latitude,
              longitude: result.longitude,
            },
          };
        })
      );

      setSearchResults(searchResultsData);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    Keyboard.dismiss();
    
    // Animate map to selected location
    mapRef.current?.animateToRegion({
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);

    console.log('Selected location:', {
      name: result.name,
      address: result.address,
      coords: result.coords,
    });

    // Navigate to confirmation screen
    setTimeout(() => {
      navigation.navigate('AddressConfirm', {
        coords: result.coords,
        label: result.name,
        address: result.address,
      });
    }, 600);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      
      {/* Map View */}
      {MapViewComp ? (
        <MapViewComp
          ref={mapRef}
          className="flex-1"
          initialRegion={mapRegion}
          onRegionChangeComplete={(region: any) => {
            if (region?.latitude && region?.longitude) {
              setMapRegion(region);
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

      {/* Close Button */}
      <TouchableOpacity
        className="absolute top-12 left-4 w-10 h-10 bg-white rounded-full items-center justify-center shadow-lg"
        onPress={handleClose}
        activeOpacity={0.7}
      >
        <Text className="text-xl text-gray-700">✕</Text>
      </TouchableOpacity>

      {/* Mini Map Toggle (Placeholder) */}
      <View className="absolute bottom-32 left-4 w-16 h-16 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <View className="flex-1 bg-gray-100 items-center justify-center">
          <Text className="text-xs text-gray-500">🗺️</Text>
        </View>
      </View>

      {/* Search Box */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="absolute bottom-0 left-0 right-0"
      >
        <View className="bg-white rounded-t-3xl shadow-2xl px-4 pt-4 pb-6">
          {/* Search Input */}
          <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-2">
            <Text className="text-xl mr-3">🔍</Text>
            <TextInput
              className="flex-1 text-base"
              placeholder="Search for location..."
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} activeOpacity={0.7}>
                <Text className="text-xl text-gray-400 ml-2">✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View className="max-h-64">
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="flex-row items-start py-3 px-2 border-b border-gray-100"
                    onPress={() => handleSelectResult(item)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-lg mr-3 mt-0.5">📍</Text>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900">
                        {item.name}
                      </Text>
                      <Text className="text-sm text-gray-600 mt-0.5" numberOfLines={2}>
                        {item.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}

          {isSearching && (
            <View className="py-4 items-center">
              <Text className="text-gray-500">Searching...</Text>
            </View>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <View className="py-4 items-center">
              <Text className="text-gray-500">No results found</Text>
            </View>
          )}

          {searchQuery.length === 0 && (
            <View className="py-4 items-center">
              <Text className="text-gray-400 text-sm">
                Search for a location to get started
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

