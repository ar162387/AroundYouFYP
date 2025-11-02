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
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import PinMarker from '../icons/PinMarker';
import CenterHairline from '../icons/CenterHairline';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useUserLocation } from '../hooks/useUserLocation';
import { useLocationSelection } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import * as addressService from '../services/addressService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SearchResult = {
  id: string;
  name: string;
  address: string;
  coords: { latitude: number; longitude: number };
};

export default function AddressSearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { coords: userCoords } = useUserLocation();
  const { setSelectedAddress } = useLocationSelection();
  const { user } = useAuth();
  const mapRef = useRef<any>(null);
  const locatingRef = useRef<boolean>(false);
  const draggingRef = useRef<boolean>(false);
  const markerOffsetY = useRef(new Animated.Value(0)).current;
  const [isMoving, setIsMoving] = useState(false);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.7);
  const SHEET_HEIGHT_MIN = Math.round(Dimensions.get('window').height * 0.3);
  const SHEET_HEIGHT_DETAILS = Math.round(Dimensions.get('window').height * 0.45);
  const [sheetMode, setSheetMode] = useState<'search' | 'confirm' | 'details'>('search');
  const sheetHeightAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [lastReverse, setLastReverse] = useState<{ formatted: string; city?: string; region?: string; streetLine?: string } | null>(null);
  const prevRegionRef = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const BUTTON_MARGIN = 16;
  const buttonsOffset = Animated.add(sheetHeightAnim, new Animated.Value(BUTTON_MARGIN));
  const sheetStartHeightRef = useRef<number>(SHEET_HEIGHT);
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  
  // New state for address details
  const [landmark, setLandmark] = useState('');
  const [selectedTitle, setSelectedTitle] = useState<addressService.AddressTitle>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Helpers
  const looksLikePlusCode = (s?: string | null) => {
    if (!s) return false;
    return /\w+\+\w+/i.test(s.trim());
  };
  const buildStreetLine = (a: any) => {
    if (a?.street) {
      const suffix = looksLikePlusCode(a?.name) ? '' : (a?.name || '');
      return [a.street, suffix].filter(Boolean).join(' ').trim();
    }
    if (a?.name && !looksLikePlusCode(a?.name)) return String(a.name);
    if (a?.district) return String(a.district);
    if (a?.city) return String(a.city);
    return 'Street address';
  };
  

  const animateSheetTo = (h: number) => {
    Animated.timing(sheetHeightAnim, { toValue: h, duration: 220, useNativeDriver: false }).start();
  };

  const panAccumRef = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sheetStartHeightRef.current = (sheetHeightAnim as any)._value ?? SHEET_HEIGHT;
      },
      onPanResponderMove: (_, gesture) => {
        panAccumRef.current = gesture.dy;
        const target = clamp(sheetStartHeightRef.current - gesture.dy, SHEET_HEIGHT_MIN, SHEET_HEIGHT);
        sheetHeightAnim.setValue(target);
        const mid = (SHEET_HEIGHT + SHEET_HEIGHT_MIN) / 2;
        if (target > mid) {
          if (sheetMode !== 'search') setSheetMode('search');
        } else {
          if (sheetMode === 'search') setSheetMode('confirm');
        }
      },
      onPanResponderRelease: () => {
        const dy = panAccumRef.current;
        panAccumRef.current = 0;
        const current = (sheetHeightAnim as any)._value ?? SHEET_HEIGHT;
        const mid = (SHEET_HEIGHT + SHEET_HEIGHT_MIN) / 2;
        if (current >= mid) {
          setSheetMode('search');
          animateSheetTo(SHEET_HEIGHT);
        } else {
          if (sheetMode !== 'details') setSheetMode('confirm');
          animateSheetTo(SHEET_HEIGHT_MIN);
        }
      },
    })
  ).current;

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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: userCoords?.latitude || 31.451483,
    longitude: userCoords?.longitude || 74.435203,
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

  // Geoapify Address Autocomplete (no Google billing required)
  const fetchGeoapifyAutocomplete = async (q: string) => {
    const key = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
    const bias = userCoords ? `&bias=proximity:${userCoords.longitude},${userCoords.latitude}` : '';
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=10&format=json${bias}&apiKey=${key}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any });
      const json = await res.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      const mapped: SearchResult[] = results.map((r: any, idx: number) => {
        const name = r?.name || r?.address_line1 || r?.street || r?.formatted?.split(',')?.[0] || q;
        const address = r?.formatted || [r?.address_line1, r?.address_line2].filter(Boolean).join(', ');
        return {
          id: r?.place_id ? String(r.place_id) : `${r?.lat}-${r?.lon}-${idx}`,
          name,
          address: address || name,
          coords: { latitude: Number(r?.lat), longitude: Number(r?.lon) },
        };
      });
      return mapped;
    } catch (e) {
      console.log('Geoapify error:', e);
      return [] as SearchResult[];
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        let suggestions = await fetchGeoapifyAutocomplete(query);
        setSearchResults(suggestions);
      } catch (e) {
        console.log('Autocomplete error:', e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectResult = async (result: SearchResult) => {
    Keyboard.dismiss();
    try {
      const coords = result.coords;

      // Animate map to selected location
      mapRef.current?.animateCamera(
        { center: { latitude: coords.latitude, longitude: coords.longitude }, zoom: 16 },
        { duration: 500 }
      );

      console.log('Selected location:', {
        name: result.name,
        address: result.address,
        coords,
      });

      // Stay on this screen (no second screen). Sheet transitions handle confirmation.
    } catch (e) {
      console.log('Select result error:', e);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Custom geolocate handler (centers map to current GPS)
  const handleGeolocate = async () => {
    try {
      if (locatingRef.current) return;
      locatingRef.current = true;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        locatingRef.current = false;
        return;
      }

      const withTimeout = <T,>(p: Promise<T>, ms: number) =>
        Promise.race([
          p,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('loc-timeout')), ms)) as Promise<T>,
        ]);

      let position = null as Location.LocationObject | null;
      try {
        position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          4000,
        );
      } catch {}

      if (!position) {
        try {
          position = await Location.getLastKnownPositionAsync();
        } catch {}
      }

      if (position?.coords) {
        const c = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(c);
        // Trigger the same motion animation as map drag
        draggingRef.current = true;
        setIsMoving(true);
        animateMarkerUp();
        // Prefer animateCamera for smoother behavior similar to default button
        const animate = mapRef.current?.animateCamera
          ? () => mapRef.current.animateCamera({ center: { latitude: c.latitude, longitude: c.longitude }, zoom: 16 }, { duration: 500 })
          : () => mapRef.current?.animateToRegion(c, 500);
        animate();
        // Ensure we settle back down even if region callback timing varies
        setTimeout(() => {
          draggingRef.current = false;
          setIsMoving(false);
          animateMarkerDown();
        }, 600);
      }
    } catch (e) {
      console.log('Geolocate error', e);
    }
    locatingRef.current = false;
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      
      {/* Map View - Platform-specific implementation */}
      {Platform.OS === 'ios' ? (
        // iOS implementation
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={mapRegion}
          onPanDrag={() => {
            if (!draggingRef.current) {
              draggingRef.current = true;
              setIsMoving(true);
              animateMarkerUp();
            }
            if (reverseDebounceRef.current) {
              clearTimeout(reverseDebounceRef.current);
              reverseDebounceRef.current = null;
            }
          }}
          onRegionChangeComplete={(region: any) => {
            if (region?.latitude && region?.longitude) {
              setMapRegion(region);
            }
            if (draggingRef.current) {
              draggingRef.current = false;
              setIsMoving(false);
              animateMarkerDown();
            }
            if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
            reverseDebounceRef.current = setTimeout(async () => {
              try {
                const center = {
                  latitude: region?.latitude ?? mapRegion.latitude,
                  longitude: region?.longitude ?? mapRegion.longitude,
                };
                const r = await Location.reverseGeocodeAsync(center);
                if (r && r.length > 0) {
                  const a = r[0];
                  const full = [a.name, a.street, a.district, a.city, a.region].filter(Boolean).join(', ');
                  const streetLine = buildStreetLine(a);
                  setLastReverse({
                    formatted: full,
                    city: (a.city || a.district || '') as string,
                    region: (a.region || '') as string,
                    streetLine,
                  });
                }
              } catch (e) {
                // Silent fail for reverse geocoding
              }
            }, 1000);
          }}
          showsUserLocation
          showsMyLocationButton={false}
        />
      ) : (
        // Android implementation
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={mapRegion}
          onPanDrag={() => {
            if (!draggingRef.current) {
              draggingRef.current = true;
              setIsMoving(true);
              animateMarkerUp();
            }
            if (reverseDebounceRef.current) {
              clearTimeout(reverseDebounceRef.current);
              reverseDebounceRef.current = null;
            }
          }}
          onRegionChangeComplete={(region: any) => {
            if (region?.latitude && region?.longitude) {
              setMapRegion(region);
            }
            if (draggingRef.current) {
              draggingRef.current = false;
              setIsMoving(false);
              animateMarkerDown();
            }
            // Debounced reverse geocoding starts 1s after map becomes stationary
            if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
            reverseDebounceRef.current = setTimeout(async () => {
              try {
                const center = {
                  latitude: region?.latitude ?? mapRegion.latitude,
                  longitude: region?.longitude ?? mapRegion.longitude,
                };
                const r = await Location.reverseGeocodeAsync(center);
                if (r && r.length > 0) {
                  const a = r[0];
                  const full = [a.name, a.street, a.district, a.city, a.region].filter(Boolean).join(', ');
                  const streetLine = buildStreetLine(a);
                  setLastReverse({
                    formatted: full,
                    city: (a.city || a.district || '') as string,
                    region: (a.region || '') as string,
                    streetLine,
                  });
                }
              } catch (e) {
                // Silent fail for reverse geocoding
              }
            }, 1000);
          }}
          showsUserLocation
          showsMyLocationButton={false}
        />
      )}

      {/* Centered Blue Marker (always centered) with attached hairline while moving */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: [
            { translateX: -18 },
            { translateY: -36 },
            { translateY: markerOffsetY },
          ],
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <PinMarker size={36} color="#3B82F6" />
          {isMoving && (
            <View style={{ marginTop: 2 }}>
              <CenterHairline height={22} color="#3B82F6" opacity={0.9} strokeWidth={1.5} dashArray="2,2" />
            </View>
          )}
        </View>
      </Animated.View>

      {/* Close (X) - top-left */}
      <TouchableOpacity
        className="absolute w-10 h-10 bg-white rounded-full items-center justify-center shadow-lg"
        style={{ top: 48, left: 16 }}
        onPress={handleClose}
        activeOpacity={0.7}
      >
        <Text className="text-xl text-gray-700">✕</Text>
      </TouchableOpacity>

      {/* Map Layer / Mini-map - stays just above the animated bottom sheet */}
      <Animated.View style={{ position: 'absolute', left: 16, bottom: buttonsOffset, zIndex: 30 }}>
        <TouchableOpacity
          className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 items-center justify-center"
          style={{ width: 56, height: 56, elevation: 8 }}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Text className="text-gray-600" style={{ fontSize: 24, lineHeight: 56, textAlign: 'center' }}>🗺️</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Custom Geolocation / GPS - stays just above the animated bottom sheet */}
      <Animated.View style={{ position: 'absolute', right: 16, bottom: buttonsOffset, zIndex: 30 }}>
        <TouchableOpacity
          className="bg-white rounded-full items-center justify-center shadow-lg border border-gray-200"
          style={{ width: 56, height: 56, elevation: 8 }}
          onPress={handleGeolocate}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 26, lineHeight: 56, textAlign: 'center', color: '#3B82F6' }}>⌖</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Search Box */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}
      >
        <Animated.View
          className="bg-white rounded-t-3xl shadow-2xl"
          style={{ height: sheetHeightAnim, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
          {...panResponder.panHandlers}
        >
          {/* Grabber */}
          <View className="items-center mb-3">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </View>

          {sheetMode === 'search' ? (
            <>
              <View className="items-center mb-3">
                <Text className="text-gray-900 text-base font-semibold">Enter the Address to Explore Shops AroundYou</Text>
              </View>
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
                <View style={{ maxHeight: 260 }}>
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        className="flex-row items-start py-3 px-2 border-b border-gray-100"
                        onPress={() => { handleSelectResult(item); setSheetMode('confirm'); animateSheetTo(SHEET_HEIGHT_MIN); }}
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
            </>
          ) : sheetMode === 'confirm' ? (
            // Confirm summary UI inside sheet
            <>
              {/* Location Header - clickable region with grey background */}
              <TouchableOpacity
                activeOpacity={0.7}
                className="mb-3 bg-gray-50 border border-gray-300 rounded-xl"
                onPress={() => {
                  setSheetMode('search');
                  animateSheetTo(SHEET_HEIGHT);
                  if (lastReverse?.formatted) setSearchQuery(lastReverse.formatted);
                }}
                style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <View className="flex-row items-center justify-between">
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      className="text-gray-900 text-base font-bold"
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {lastReverse?.streetLine || 'Street address'}
                    </Text>
                    <Text className="text-gray-600" numberOfLines={1} ellipsizeMode="tail">
                      {lastReverse?.city || ''}
                    </Text>
                  </View>
                  <Text className="text-gray-500 text-lg" style={{ paddingLeft: 8 }}>✎</Text>
                </View>
              </TouchableOpacity>

              {/* Info Box */}
              <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                <Text className="text-blue-700 text-sm">
                  Your rider will deliver to the pinned location. You can make changes to your written address on the next page.
                </Text>
              </View>

              {/* Primary Action */}
              <TouchableOpacity
                className="bg-blue-600 rounded-xl py-3 items-center"
                onPress={() => {
                  prevRegionRef.current = mapRegion;
                  const newRegion = {
                    latitude: mapRegion.latitude,
                    longitude: mapRegion.longitude,
                    latitudeDelta: Math.max(mapRegion.latitudeDelta * 0.25, 0.0005),
                    longitudeDelta: Math.max(mapRegion.longitudeDelta * 0.25, 0.0005),
                  };
                  mapRef.current?.animateToRegion(newRegion, 400);
                  setSheetMode('details');
                  animateSheetTo(SHEET_HEIGHT_DETAILS);
                }}
                activeOpacity={0.7}
              >
                <Text className="text-white font-bold">Add address details</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Details UI within the sheet (previously separate screen)
            <>
              <View className="mb-3">
                <Text className="text-gray-900 text-base font-bold mb-1">Help the Rider Find Your location</Text>
                <Text className="text-gray-600 text-sm">Place the pin exactly on your building entrance for smooth delivery</Text>
              </View>

              <View className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <Text className="text-gray-900 font-semibold" numberOfLines={2} ellipsizeMode="tail">{lastReverse?.streetLine || 'Street address'}</Text>
                <Text className="text-gray-600" numberOfLines={1} ellipsizeMode="tail">{lastReverse?.city || ''}</Text>
              </View>

              {/* Optional landmark field - only show if authenticated */}
              {user && (
                <>
                  <View className="mb-4">
                    <Text className="text-gray-700 text-sm font-medium mb-2">Add Flat / House / Street number or Landmark (optional)</Text>
                    <TextInput
                      className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-base"
                      placeholder="e.g., Flat 2B, House 45, Near Main Gate"
                      value={landmark}
                      onChangeText={setLandmark}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Address Title Selection */}
                  <View className="mb-4">
                    <Text className="text-gray-700 text-sm font-medium mb-2">Address Title (optional, unique)</Text>
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${
                          selectedTitle === 'home'
                            ? 'bg-blue-50 border-blue-600'
                            : 'bg-white border-gray-300'
                        }`}
                        onPress={() => {
                          setSelectedTitle(selectedTitle === 'home' ? null : 'home');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-xl mr-2">🏠</Text>
                        <Text className={`font-semibold ${selectedTitle === 'home' ? 'text-blue-600' : 'text-gray-700'}`}>
                          Home
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${
                          selectedTitle === 'office'
                            ? 'bg-blue-50 border-blue-600'
                            : 'bg-white border-gray-300'
                        }`}
                        onPress={() => {
                          setSelectedTitle(selectedTitle === 'office' ? null : 'office');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-xl mr-2">🏢</Text>
                        <Text className={`font-semibold ${selectedTitle === 'office' ? 'text-blue-600' : 'text-gray-700'}`}>
                          Office
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-white border-2 border-blue-600 rounded-xl py-3 items-center"
                  onPress={() => {
                    setSheetMode('confirm');
                    if (prevRegionRef.current) {
                      mapRef.current?.animateToRegion(prevRegionRef.current, 400);
                    }
                    animateSheetTo(SHEET_HEIGHT_MIN);
                  }}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <Text className="text-blue-600 font-bold">Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 bg-blue-600 rounded-xl py-3 items-center ${isSaving ? 'opacity-60' : ''}`}
                  onPress={async () => {
                    if (isSaving) return;
                    setIsSaving(true);
                    try {
                      const center = {
                        latitude: mapRegion.latitude,
                        longitude: mapRegion.longitude,
                      };
                      const streetAddress = lastReverse?.streetLine || lastReverse?.formatted?.split(',')[0] || 'Street address';
                      const city = lastReverse?.city || '';
                      const region = lastReverse?.region || undefined;
                      const formatted = lastReverse?.formatted || '';

                      // Save address if user is authenticated
                      if (user) {
                        const { data: savedAddress, error: saveError } = await addressService.createAddress({
                          title: selectedTitle || undefined,
                          street_address: streetAddress,
                          city,
                          region,
                          latitude: center.latitude,
                          longitude: center.longitude,
                          landmark: landmark.trim() || undefined,
                          formatted_address: formatted || undefined,
                        });

                        if (saveError) {
                          console.log('Error saving address:', saveError);
                          // Still continue to set selected address even if save fails
                        } else {
                          console.log('✅ Address saved:', savedAddress);
                        }
                      }

                      // Persist selected address in context
                      const label = streetAddress;
                      setSelectedAddress({ label, city, coords: center, isCurrent: false });
                      console.log('✅ Confirmed Address (details):', { label, city, coords: center });
                      
                      // Close flow back to Home where the bottom sheet is available
                      navigation.goBack();
                    } catch (err) {
                      console.log('Error confirming address:', err);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <Text className="text-white font-bold">{isSaving ? 'Saving...' : 'Confirm location'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

