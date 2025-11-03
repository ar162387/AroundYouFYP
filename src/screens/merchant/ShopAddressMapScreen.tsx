import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Keyboard,
  Animated,
  ScrollView,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation, useRoute, RouteProp as RNRouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import AddressSearchMap from '../../components/maps/AddressSearchMap';
import { useLocationStore } from '../../stores/locationStore';
import { useGeoapifyAutocomplete, SearchResult } from '../../hooks/useLocationQueries';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShopAddressMap'>;
type ShopAddressMapRouteProp = RNRouteProp<RootStackParamList, 'ShopAddressMap'>;

// Pakistan center (Lahore area)
const PAKISTAN_CENTER = {
  latitude: 31.451483,
  longitude: 74.435203,
};

export default function ShopAddressMapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ShopAddressMapRouteProp>();
  const insets = useSafeAreaInsets();
  
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);

  // Map and UI refs
  const mapRef = useRef<any>(null);
  const locatingRef = useRef<boolean>(false);
  const draggingRef = useRef<boolean>(false);
  const markerOffsetY = useRef(new Animated.Value(0)).current;
  const [isMoving, setIsMoving] = useState(false);

  // Debounce/timeout refs
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticMoveRef = useRef<boolean>(false);
  const lastRegionRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Map region state - initialize from confirmed location or default
  const [mapRegion, setMapRegion] = useState({
    latitude: confirmedLocation?.coords?.latitude || PAKISTAN_CENTER.latitude,
    longitude: confirmedLocation?.coords?.longitude || PAKISTAN_CENTER.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Reverse geocode result
  const [reverseGeocode, setReverseGeocode] = useState<{
    formatted: string;
    city?: string;
    region?: string;
    streetLine?: string;
  } | null>(null);

  // React Query hooks
  const { data: searchResults = [], isLoading: isSearching } = useGeoapifyAutocomplete(
    searchQuery,
    searchQuery.trim().length >= 2 && showSearchResults,
    mapRegion
  );

  // Initialize map region from confirmed location
  useEffect(() => {
    if (confirmedLocation?.coords) {
      const coords = {
        latitude: confirmedLocation.coords.latitude,
        longitude: confirmedLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(coords);
      lastRegionRef.current = confirmedLocation.coords;
      
      // Set initial reverse geocode
      setReverseGeocode({
        formatted: confirmedLocation.address || confirmedLocation.streetLine || 'Selected location',
        city: confirmedLocation.city,
        region: confirmedLocation.region,
        streetLine: confirmedLocation.streetLine,
      });
    } else {
      lastRegionRef.current = PAKISTAN_CENTER;
    }
  }, []);

  /**
   * MARKER ANIMATION
   */
  const animateMarkerUp = () => {
    Animated.timing(markerOffsetY, {
      toValue: -12,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const animateMarkerDown = () => {
    Animated.timing(markerOffsetY, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  /**
   * MAP DRAG HANDLERS
   */
  const endDragging = (regionHint?: { latitude: number; longitude: number }) => {
    if (moveEndTimeoutRef.current) {
      clearTimeout(moveEndTimeoutRef.current);
      moveEndTimeoutRef.current = null;
    }
    if (!draggingRef.current && !isMoving) return;

    const finalCoords = regionHint || lastRegionRef.current || {
      latitude: mapRegion.latitude,
      longitude: mapRegion.longitude,
    };

    setMapRegion((prev) => ({
      latitude: finalCoords.latitude,
      longitude: finalCoords.longitude,
      latitudeDelta: prev.latitudeDelta,
      longitudeDelta: prev.longitudeDelta,
    }));
    lastRegionRef.current = finalCoords;

    draggingRef.current = false;
    setIsMoving(false);
    animateMarkerDown();

    // Debounced reverse geocoding
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
    reverseDebounceRef.current = setTimeout(async () => {
      try {
        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${finalCoords.latitude}&lon=${finalCoords.longitude}&format=json&apiKey=3e078bb3a2bc4892b9e1757e92860438`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any,
        });
        const json = await res.json();
        if (json?.results?.length > 0) {
          const result = json.results[0];
          const street = result?.street || '';
          const houseNumber = result?.housenumber || '';
          const district = result?.district || result?.suburb || '';
          const city = result?.city || '';
          const state = result?.state || '';
          const streetLine = [houseNumber, street].filter(Boolean).join(' ') || district || city || 'Street address';
          const full = result?.formatted || [streetLine, city, state].filter(Boolean).join(', ');
          setReverseGeocode({
            formatted: full,
            city: (city || district || '') as string,
            region: (state || '') as string,
            streetLine,
          });
        }
      } catch (_) {}
    }, 1000);
  };

  const handleMapTouchStart = () => {
    if (!programmaticMoveRef.current && !locatingRef.current) {
      draggingRef.current = true;
      setIsMoving(true);
      animateMarkerUp();
    }
  };

  const handleRegionChangeComplete = (region: any) => {
    if (region?.latitude && region?.longitude) {
      setMapRegion(region);
      lastRegionRef.current = { latitude: region.latitude, longitude: region.longitude };

      if (draggingRef.current) {
        if (regionChangeTimeoutRef.current) clearTimeout(regionChangeTimeoutRef.current);
        regionChangeTimeoutRef.current = setTimeout(() => {
          endDragging({ latitude: region.latitude, longitude: region.longitude });
        }, 120);
      }
    }
  };

  const handleMapTouchEnd = async () => {
    if (draggingRef.current && !programmaticMoveRef.current && Platform.OS === 'android') {
      setTimeout(async () => {
        try {
          let finalCoords = null;
          if (mapRef.current?.getCamera) {
            try {
              const camera = await mapRef.current.getCamera();
              if (camera?.center) {
                finalCoords = { latitude: camera.center.latitude, longitude: camera.center.longitude };
              }
            } catch (_) {}
          }

          if (!finalCoords && mapRef.current?.getCenter) {
            try {
              const center = await mapRef.current.getCenter();
              if (center) {
                finalCoords = { latitude: center.latitude, longitude: center.longitude };
              }
            } catch (_) {}
          }

          if (!finalCoords) {
            finalCoords = lastRegionRef.current || {
              latitude: mapRegion.latitude,
              longitude: mapRegion.longitude,
            };
          }

          if (finalCoords && draggingRef.current) {
            endDragging(finalCoords);
          }
        } catch (_) {
          const fallbackCoords = lastRegionRef.current || {
            latitude: mapRegion.latitude,
            longitude: mapRegion.longitude,
          };
          if (draggingRef.current) {
            endDragging(fallbackCoords);
          }
        }
      }, 150);
    } else if (draggingRef.current && !programmaticMoveRef.current && Platform.OS === 'ios') {
      endDragging(lastRegionRef.current || {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      });
    }
  };

  const handleAndroidResponderMove = () => {
    if (!draggingRef.current && !programmaticMoveRef.current && !locatingRef.current) {
      draggingRef.current = true;
      setIsMoving(true);
      animateMarkerUp();
    }
  };

  /**
   * SEARCH HANDLERS
   */
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setShowSearchResults(query.trim().length >= 2);
  };

  const handleSelectResult = (result: SearchResult) => {
    Keyboard.dismiss();
    setShowSearchResults(false);
    setSearchQuery('');

    const coords = result.coords;
    const newRegion = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setMapRegion(newRegion);
    lastRegionRef.current = coords;

    programmaticMoveRef.current = true;
    mapRef.current?.animateCamera?.(
      { center: coords, zoom: 16 },
      { duration: 500 }
    );

    setTimeout(() => {
      programmaticMoveRef.current = false;
    }, 600);

    const addressParts = result.address.split(',').map((p) => p.trim());
    const streetLine = result.name;
    const cityParts = addressParts.filter((part) => {
      const lower = part.toLowerCase();
      return !/\d{4,}/.test(part) && !['pakistan', 'pk', 'usa', 'uk'].includes(lower) && part.length > 2;
    });
    const city = cityParts.length > 1 ? cityParts[1] : cityParts[0] || '';

    setReverseGeocode({
      formatted: result.address,
      city,
      region: undefined,
      streetLine,
    });
  };

  /**
   * GEOLOCATE HANDLER
   */
  const handleGeolocate = async () => {
    try {
      if (locatingRef.current) return;
      locatingRef.current = true;

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          locatingRef.current = false;
          return;
        }
      }

      const position = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 4000);
        Geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeout);
            resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          },
          () => {
            clearTimeout(timeout);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 10000 }
        );
      });

      if (position) {
        const c = {
          latitude: position.latitude,
          longitude: position.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(c);
        lastRegionRef.current = position;

        programmaticMoveRef.current = true;
        draggingRef.current = true;
        setIsMoving(true);
        animateMarkerUp();

        mapRef.current?.animateCamera?.(
          { center: position, zoom: 16 },
          { duration: 500 }
        );

        setTimeout(() => {
          draggingRef.current = false;
          setIsMoving(false);
          animateMarkerDown();
          programmaticMoveRef.current = false;
          endDragging(position);
        }, 600);
      }
    } catch (_) {}
    locatingRef.current = false;
  };

  /**
   * CONFIRM LOCATION
   */
  const handleConfirmLocation = () => {
    const coords = lastRegionRef.current || {
      latitude: mapRegion.latitude,
      longitude: mapRegion.longitude,
    };

    const address = reverseGeocode?.formatted || reverseGeocode?.streetLine || 'Selected location';

    navigation.navigate('CreateShop', {
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Header with Back Button and Search */}
      <View className="absolute top-0 left-0 right-0 z-30" style={{ paddingTop: insets.top }}>
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-4 pb-3"
        >
          <View className="flex-row items-center mb-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mr-3"
              activeOpacity={0.7}
            >
              <Text className="text-white text-2xl">←</Text>
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold flex-1">Select Shop Address</Text>
          </View>
          
          {/* Search Bar */}
          <View className="bg-white/95 rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-xl mr-3">🔍</Text>
            <TextInput
              className="flex-1 text-base text-gray-900"
              placeholder="Search for location..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={handleSearch}
              onFocus={() => setShowSearchResults(searchQuery.trim().length >= 2)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                setShowSearchResults(false);
                Keyboard.dismiss();
              }} activeOpacity={0.7}>
                <Text className="text-xl text-gray-400 ml-2">✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results */}
          {showSearchResults && searchResults.length > 0 && (
            <ScrollView
              className="bg-white rounded-xl mt-2 max-h-48 shadow-lg"
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((item: SearchResult) => (
                <TouchableOpacity
                  key={item.id}
                  className="flex-row items-start py-3 px-4 border-b border-gray-100"
                  onPress={() => handleSelectResult(item)}
                  activeOpacity={0.7}
                >
                  <Text className="text-lg mr-3 mt-0.5">📍</Text>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                    <Text className="text-sm text-gray-600 mt-0.5" numberOfLines={2}>
                      {item.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {isSearching && (
            <View className="bg-white rounded-xl mt-2 py-4 px-4 items-center">
              <Text className="text-gray-500">Searching...</Text>
            </View>
          )}
        </LinearGradient>
      </View>

      {/* Map View */}
      <AddressSearchMap
        mapRef={mapRef}
        initialRegion={mapRegion}
        onTouchStart={handleMapTouchStart}
        onRegionChangeComplete={handleRegionChangeComplete}
        onTouchEnd={handleMapTouchEnd}
        onAndroidResponderMove={handleAndroidResponderMove}
        isMoving={isMoving}
        markerOffsetY={markerOffsetY}
      />

      {/* Buttons at Bottom */}
      <View className="absolute bottom-8 left-4 right-4 z-20 gap-3">
        {/* Geolocate Button */}
        <TouchableOpacity
          className="bg-white rounded-full items-center justify-center shadow-lg border border-gray-200 self-end"
          style={{ width: 56, height: 56 }}
          onPress={handleGeolocate}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 26, color: '#3B82F6' }}>⌖</Text>
        </TouchableOpacity>

        {/* Confirm Location Button */}
        <TouchableOpacity
          className="bg-blue-600 rounded-xl py-4 px-6 items-center shadow-lg"
          onPress={handleConfirmLocation}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-lg">Confirm Address</Text>
          {reverseGeocode && (
            <Text className="text-white/80 text-sm mt-1" numberOfLines={1}>
              {reverseGeocode.streetLine || reverseGeocode.city || 'Selected location'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

