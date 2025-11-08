import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  Keyboard,
  Animated,
  Dimensions,
  PanResponder,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import Config from 'react-native-config';
import { useNavigation, useRoute, RouteProp as RNRouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import * as addressService from '../../services/consumer/addressService';
import AddressSearchMap from '../../components/maps/AddressSearchMap';
import AddressSearchBottomSheet, { SearchResult, SheetMode } from '../../components/consumer/AddressSearchBottomSheet';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type AddressSearchRouteProp = RNRouteProp<RootStackParamList, 'AddressSearch'>;

/**
 * AddressSearchScreen - Three-state address selection flow
 * 
 * TRANSITION STATES:
 * 1. SEARCH (90% screen height) - User searches for address, map shows below
 * 2. CONFIRM (30% screen height) - Shows selected address, map animates to location
 * 3. DETAILS (45% screen height) - Precise pin placement, optional landmark/title
 */
export default function AddressSearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AddressSearchRouteProp>();
  const editingAddress = route.params?.address;
  const { coords: userCoords } = useUserLocation();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();
  const { user } = useAuth();
  
  // Map and UI refs
  const mapRef = useRef<any>(null);
  const locatingRef = useRef<boolean>(false);
  const draggingRef = useRef<boolean>(false);
  const markerOffsetY = useRef(new Animated.Value(0)).current;
  const [isMoving, setIsMoving] = useState(false);
  
  // Debounce/timeout refs for map interactions
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticMoveRef = useRef<boolean>(false);
  const lastRegionRef = useRef<{latitude: number; longitude: number} | null>(null);
  
  // Bottom sheet dimensions and state
  const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.9); // State 1: Search
  const SHEET_HEIGHT_MIN = Math.round(Dimensions.get('window').height * 0.38); // State 2: Confirm
  const SHEET_HEIGHT_PINPOINT = Math.round(Dimensions.get('window').height * 0.35); // State 3: Pinpoint (reduced)
  const SHEET_HEIGHT_DETAILS = Math.round(Dimensions.get('window').height * 0.65); // State 4: Details (larger for form)
  const [sheetMode, setSheetMode] = useState<SheetMode>('search');
  const sheetHeightAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetBottomAnim = useRef(new Animated.Value(0)).current; // For keyboard adjustment
  const cameFromPinpointRef = useRef<boolean>(false); // Track if we came from pinpoint state
  const keyboardHeightRef = useRef<number>(0);
  
  // Address state
  const [lastReverse, setLastReverse] = useState<{ formatted: string; city?: string; region?: string; streetLine?: string } | null>(null);
  const prevRegionRef = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  
  // Floating button positioning
  const BUTTON_MARGIN = 16;
  const buttonsOffset = Animated.add(sheetHeightAnim, new Animated.Value(BUTTON_MARGIN));
  const sheetStartHeightRef = useRef<number>(SHEET_HEIGHT);
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  
  // Address details form state
  const [landmark, setLandmark] = useState('');
  const [selectedTitle, setSelectedTitle] = useState<addressService.AddressTitle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editingAddressIdRef = useRef<string | null>(editingAddress?.id || null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Map region state - initialized with fallback priority: editingAddress > selectedAddress > userCoords > default
  const [mapRegion, setMapRegion] = useState({
    latitude: editingAddress?.latitude || selectedAddress?.coords?.latitude || userCoords?.latitude || 31.451483,
    longitude: editingAddress?.longitude || selectedAddress?.coords?.longitude || userCoords?.longitude || 74.435203,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  /**
   * BOTTOM SHEET ANIMATION
   * Handles smooth transitions between the three states
   */
  const animateSheetTo = (h: number) => {
    Animated.timing(sheetHeightAnim, { toValue: h, duration: 220, useNativeDriver: false }).start();
  };

  /**
   * LOAD EDITING ADDRESS
   * If editing an existing address, load its data into the form
   */
  useEffect(() => {
    if (editingAddress) {
      // Set map region to address location
      const coords = {
        latitude: editingAddress.latitude,
        longitude: editingAddress.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(coords);
      lastRegionRef.current = { latitude: coords.latitude, longitude: coords.longitude };
      
      // Set form fields
      setLandmark(editingAddress.landmark || '');
      setSelectedTitle(editingAddress.title || null);
      
      // Set address display data
      setLastReverse({
        formatted: editingAddress.formatted_address || editingAddress.street_address,
        city: editingAddress.city || '',
        region: editingAddress.region || undefined,
        streetLine: editingAddress.street_address,
      });
      
      // Pre-fill search query
      if (editingAddress.street_address && editingAddress.city) {
        setSearchQuery(`${editingAddress.street_address}, ${editingAddress.city}`);
      }
      
      // Animate map to address location and go to details state if user is authenticated
      setTimeout(() => {
        if (mapRef.current) {
          programmaticMoveRef.current = true;
          mapRef.current?.animateCamera?.(
            { center: { latitude: coords.latitude, longitude: coords.longitude }, zoom: 16 },
            { duration: 500 }
          );
          setTimeout(() => {
            programmaticMoveRef.current = false;
            setSheetMode('confirm');
            animateSheetTo(SHEET_HEIGHT_MIN);
          }, 600);
        }
      }, 100);
    }
  }, [editingAddress]);

  /**
   * INITIAL LOCATION LOADING
   * Loads current GPS location behind the scenes when screen opens
   * Falls back to selectedAddress from context, then userCoords, then default
   * Skip if editing an address (already loaded above)
   */
  useEffect(() => {
    if (editingAddress) return; // Skip GPS loading when editing
    
    let isMounted = true;
    
    const loadInitialLocation = async () => {
      try {
        // Request location permission
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            // Use fallback if permission denied
            const fallbackCoords = selectedAddress?.coords || userCoords;
            if (fallbackCoords && isMounted) {
              setMapRegion({
                latitude: fallbackCoords.latitude,
                longitude: fallbackCoords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }
            return;
          }
        }

        // Get current GPS position
        const position = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 3000);
          Geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeout);
              resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            () => {
              clearTimeout(timeout);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 3000, maximumAge: 5000 }
          );
        });

        if (isMounted) {
          if (position) {
            // Successfully got GPS location - update map
            setMapRegion({
              latitude: position.latitude,
              longitude: position.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            lastRegionRef.current = { latitude: position.latitude, longitude: position.longitude };
            
            // Reverse geocode to get address
            try {
              const geoapifyKey = Config.GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
              const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${position.latitude}&lon=${position.longitude}&format=json&apiKey=${geoapifyKey}`;
              const res = await fetch(url, { headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any });
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
                setLastReverse({ formatted: full, city: (city || district || '') as string, region: (state || '') as string, streetLine });
              }
            } catch (_) {
              // Silent fail for reverse geocoding
            }
          } else {
            // GPS failed - use fallback
            const fallbackCoords = selectedAddress?.coords || userCoords;
            if (fallbackCoords) {
              setMapRegion({
                latitude: fallbackCoords.latitude,
                longitude: fallbackCoords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }
          }
        }
      } catch (_) {
        // Silent fail - use fallback
        if (isMounted) {
          const fallbackCoords = selectedAddress?.coords || userCoords;
          if (fallbackCoords) {
            setMapRegion({
              latitude: fallbackCoords.latitude,
              longitude: fallbackCoords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        }
      }
    };

    loadInitialLocation();
    
    return () => {
      isMounted = false;
    };
  }, [editingAddress]); // Skip if editing address

  // Update map region when location sources change (after initial load)
  useEffect(() => {
    const coords = selectedAddress?.coords || userCoords;
    if (coords && !locatingRef.current && !draggingRef.current) {
      setMapRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [selectedAddress?.coords, userCoords]);

  /**
   * KEYBOARD HANDLING FOR DETAILS STATE
   * Adjusts bottom sheet position when keyboard shows/hides in details state
   */
  useEffect(() => {
    if (sheetMode !== 'details') {
      // Reset bottom position when not in details mode
      sheetBottomAnim.setValue(0);
      return;
    }

    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        keyboardHeightRef.current = e.endCoordinates.height;
        // Move bottom sheet up by keyboard height to keep input visible
        Animated.timing(sheetBottomAnim, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? e.duration || 250 : 250,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        keyboardHeightRef.current = 0;
        // Move bottom sheet back to bottom
        Animated.timing(sheetBottomAnim, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? e.duration || 250 : 250,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [sheetMode]);

  /**
   * BOTTOM SHEET DRAG HANDLER
   * Allows user to drag sheet between search (90%) and confirm (30%) states
   */
  const panAccumRef = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sheetStartHeightRef.current = (sheetHeightAnim as any)._value ?? SHEET_HEIGHT;
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gesture) => {
        panAccumRef.current = gesture.dy;
        let minHeight = SHEET_HEIGHT_MIN;
        let maxHeight = SHEET_HEIGHT;
        
        if (sheetMode === 'pinpoint') {
          minHeight = SHEET_HEIGHT_MIN;
          maxHeight = SHEET_HEIGHT_PINPOINT;
        } else if (sheetMode === 'details') {
          minHeight = cameFromPinpointRef.current ? SHEET_HEIGHT_PINPOINT : SHEET_HEIGHT_MIN;
          maxHeight = SHEET_HEIGHT_DETAILS;
        }
        
        const target = clamp(sheetStartHeightRef.current - gesture.dy, minHeight, maxHeight);
        sheetHeightAnim.setValue(target);
        
        if (sheetMode === 'search') {
          const mid = (SHEET_HEIGHT + SHEET_HEIGHT_MIN) / 2;
          if (target > mid) {
            // Stay in search mode
          } else {
            // Always go to confirm state
            setSheetMode('confirm');
          }
        }
      },
      onPanResponderRelease: () => {
        const dy = panAccumRef.current;
        panAccumRef.current = 0;
        const current = (sheetHeightAnim as any)._value ?? SHEET_HEIGHT;
        
        if (sheetMode === 'search') {
          const mid = (SHEET_HEIGHT + SHEET_HEIGHT_MIN) / 2;
          if (current >= mid) {
            setSheetMode('search');
            animateSheetTo(SHEET_HEIGHT);
          } else {
            // Always go to confirm state
            setSheetMode('confirm');
            animateSheetTo(SHEET_HEIGHT_MIN);
          }
        } else if (sheetMode === 'confirm') {
          const mid = (SHEET_HEIGHT + SHEET_HEIGHT_MIN) / 2;
          if (current >= mid) {
            setSheetMode('search');
            animateSheetTo(SHEET_HEIGHT);
          } else {
            setSheetMode('confirm');
            animateSheetTo(SHEET_HEIGHT_MIN);
          }
        } else if (sheetMode === 'pinpoint') {
          const mid = (SHEET_HEIGHT_PINPOINT + SHEET_HEIGHT_MIN) / 2;
          if (current >= mid) {
            setSheetMode('pinpoint');
            animateSheetTo(SHEET_HEIGHT_PINPOINT);
          } else {
            setSheetMode('confirm');
            animateSheetTo(SHEET_HEIGHT_MIN);
          }
        } else if (sheetMode === 'details') {
          const mid = (SHEET_HEIGHT_DETAILS + SHEET_HEIGHT_PINPOINT) / 2;
          if (current >= mid) {
            setSheetMode('details');
            animateSheetTo(SHEET_HEIGHT_DETAILS);
          } else {
            if (cameFromPinpointRef.current) {
              setSheetMode('pinpoint');
              animateSheetTo(SHEET_HEIGHT_PINPOINT);
            } else {
              setSheetMode('confirm');
              animateSheetTo(SHEET_HEIGHT_MIN);
            }
          }
        }
      },
    })
  ).current;

  /**
   * MARKER ANIMATION
   * Marker moves up with hairline when map is being dragged/zoomed
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
   * MAP DRAG DETECTION & REVERSE GEOCODING
   * 
   * When user drags map:
   * 1. onTouchStart detects drag start → marker animates up, hairline appears
   * 2. User drags map → coordinates update
   * 3. onRegionChangeComplete fires when drag stops → marker animates down
   * 4. After 1s debounce → reverse geocoding updates address
   * 
   * When geolocate button pressed:
   * 1. Gets GPS location → animates map to location
   * 2. Marker animates up during animation → down when complete
   * 3. Reverse geocoding updates address
   */
  const endDragging = (regionHint?: { latitude: number; longitude: number }) => {
    if (moveEndTimeoutRef.current) {
      clearTimeout(moveEndTimeoutRef.current);
      moveEndTimeoutRef.current = null;
    }
    if (!draggingRef.current && !isMoving) return;
    
    const finalCoords = regionHint || lastRegionRef.current || { latitude: mapRegion.latitude, longitude: mapRegion.longitude };
    
    // Update coordinates when dragging stops
    setMapRegion((prev) => ({
      latitude: finalCoords.latitude,
      longitude: finalCoords.longitude,
      latitudeDelta: prev.latitudeDelta,
      longitudeDelta: prev.longitudeDelta,
    }));
    lastRegionRef.current = finalCoords;
    
    // Reset drag state and animate marker down
    draggingRef.current = false;
    setIsMoving(false);
    animateMarkerDown();
    
    // Debounced reverse geocoding - updates address after 1s of stillness
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
    reverseDebounceRef.current = setTimeout(async () => {
      try {
        const geoapifyKey = Config.GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${finalCoords.latitude}&lon=${finalCoords.longitude}&format=json&apiKey=${geoapifyKey}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any });
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
          setLastReverse({ formatted: full, city: (city || district || '') as string, region: (state || '') as string, streetLine });
        }
      } catch (_) {}
    }, 1000);
  };

  /**
   * GEOAPIFY ADDRESS AUTOCOMPLETE
   * Searches for addresses as user types
   */
  const fetchGeoapifyAutocomplete = async (q: string) => {
    const key = Config.GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
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
    } catch (_) {
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
      } catch (_) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  /**
   * TRANSITION 1 → 2: Search Result Selected
   * User selects address from search → animates map to location → transitions to confirm state
   */
  const handleSelectResult = async (result: SearchResult) => {
    Keyboard.dismiss();
    try {
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
      
      mapRef.current?.animateCamera(
        { center: { latitude: coords.latitude, longitude: coords.longitude }, zoom: 16 },
        { duration: 500 }
      );
      
      setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 600);

      // Parse address - extract only street and city (no postal code/region)
      const addressParts = result.address.split(',').map(p => p.trim());
      const streetLine = result.name;
      // Get city (skip postal codes and country codes)
      const cityParts = addressParts.filter(part => {
        const lower = part.toLowerCase();
        // Filter out postal codes, country codes, and common non-city strings
        return !/\d{4,}/.test(part) && 
               !['pakistan', 'pk', 'usa', 'uk'].includes(lower) &&
               part.length > 2;
      });
      const city = cityParts.length > 1 ? cityParts[1] : (cityParts[0] || '');
      
      setLastReverse({
        formatted: result.address,
        city,
        region: undefined,
        streetLine,
      });

      setSearchResults([]);
      setSearchQuery('');
      
      // Always transition to confirm state
      setSheetMode('confirm');
      animateSheetTo(SHEET_HEIGHT_MIN);
    } catch (_) {}
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const handleClose = () => {
    navigation.goBack();
  };

  /**
   * GEOLOCATE BUTTON HANDLER
   * Gets current GPS location and animates map to it
   * Same marker animation as manual drag
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
        lastRegionRef.current = { latitude: c.latitude, longitude: c.longitude };
        
        programmaticMoveRef.current = true;
        draggingRef.current = true;
        setIsMoving(true);
        animateMarkerUp();
        
        const animate = mapRef.current?.animateCamera
          ? () => mapRef.current.animateCamera({ center: { latitude: c.latitude, longitude: c.longitude }, zoom: 16 }, { duration: 500 })
          : () => mapRef.current?.animateToRegion(c, 500);
        animate();
        
        setTimeout(async () => {
          draggingRef.current = false;
          setIsMoving(false);
          animateMarkerDown();
          programmaticMoveRef.current = false;
          
          // Reverse geocode after animation
          try {
            const geoapifyKey = Config.GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
            const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${c.latitude}&lon=${c.longitude}&format=json&apiKey=${geoapifyKey}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any });
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
              setLastReverse({
                formatted: full,
                city: (city || district || '') as string,
                region: (state || '') as string,
                streetLine,
              });
            }
          } catch (_) {}
        }, 600);
      }
    } catch (_) {}
    locatingRef.current = false;
  };

  /**
   * MAP VIEW HANDLERS
   * Handles user drag detection and coordinate updates
   */
  const handleMapTouchStart = () => {
    if (!programmaticMoveRef.current && !locatingRef.current) {
      draggingRef.current = true;
      setIsMoving(true);
      animateMarkerUp();
      if (moveEndTimeoutRef.current) clearTimeout(moveEndTimeoutRef.current);
      moveEndTimeoutRef.current = setTimeout(() => endDragging(), 2000);
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
        if (moveEndTimeoutRef.current) {
          clearTimeout(moveEndTimeoutRef.current);
          moveEndTimeoutRef.current = null;
        }
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
            finalCoords = lastRegionRef.current || { latitude: mapRegion.latitude, longitude: mapRegion.longitude };
          }
          
          if (finalCoords && draggingRef.current) {
            endDragging(finalCoords);
          }
        } catch (_) {
          const fallbackCoords = lastRegionRef.current || { latitude: mapRegion.latitude, longitude: mapRegion.longitude };
          if (draggingRef.current) {
            endDragging(fallbackCoords);
          }
        }
      }, 150);
    } else if (draggingRef.current && !programmaticMoveRef.current && Platform.OS === 'ios') {
      endDragging(lastRegionRef.current || { latitude: mapRegion.latitude, longitude: mapRegion.longitude });
    }
  };

  const handleAndroidResponderMove = () => {
    if (!draggingRef.current && !programmaticMoveRef.current && !locatingRef.current) {
      draggingRef.current = true;
      setIsMoving(true);
      animateMarkerUp();
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      
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

      {/* Close Button */}
      <TouchableOpacity
        className="absolute w-10 h-10 bg-white rounded-full items-center justify-center shadow-lg"
        style={{ top: 48, left: 16 }}
        onPress={handleClose}
        activeOpacity={0.7}
      >
        <Text className="text-xl text-gray-700">✕</Text>
      </TouchableOpacity>

      {/* Map Layer Button */}
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

      {/* Geolocate Button */}
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

      {/* Bottom Sheet - Three States */}
      <AddressSearchBottomSheet
        sheetHeightAnim={sheetHeightAnim}
        sheetBottomAnim={sheetBottomAnim}
        sheetMode={sheetMode}
        setSheetMode={setSheetMode}
        animateSheetTo={animateSheetTo}
        SHEET_HEIGHT={SHEET_HEIGHT}
        SHEET_HEIGHT_MIN={SHEET_HEIGHT_MIN}
        SHEET_HEIGHT_PINPOINT={SHEET_HEIGHT_PINPOINT}
        SHEET_HEIGHT_DETAILS={SHEET_HEIGHT_DETAILS}
        panHandlers={panResponder.panHandlers}
        searchQuery={searchQuery}
        isSearching={isSearching}
        searchResults={searchResults}
        onSearchChange={handleSearch}
        onClearSearch={handleClearSearch}
        onSelectResult={handleSelectResult}
        lastReverse={lastReverse}
        mapRegion={mapRegion}
        user={user}
        landmark={landmark}
        onChangeLandmark={setLandmark}
        selectedTitle={selectedTitle}
        onToggleTitle={(title) => {
          setSelectedTitle(selectedTitle === title ? null : title);
        }}
        isSaving={isSaving}
        onAddDetails={() => {
          // Save current region before zooming in
          prevRegionRef.current = mapRegion;
          // Set street-level zoom (very zoomed in)
          const newRegion = {
            latitude: mapRegion.latitude,
            longitude: mapRegion.longitude,
            latitudeDelta: Math.max(mapRegion.latitudeDelta * 0.25, 0.0005),
            longitudeDelta: Math.max(mapRegion.longitudeDelta * 0.25, 0.0005),
          };
          setMapRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 400);
          setSheetMode('pinpoint');
          animateSheetTo(SHEET_HEIGHT_PINPOINT);
        }}
        onPinpointComplete={() => {
          cameFromPinpointRef.current = true;
          // Preserve zoom level from pinpoint state (street level)
          // The mapRegion already has the street-level zoom, so we just transition
          setSheetMode('details');
          animateSheetTo(SHEET_HEIGHT_DETAILS);
        }}
        onBackFromPinpoint={() => {
          if (prevRegionRef.current) {
            setMapRegion(prevRegionRef.current);
            mapRef.current?.animateToRegion(prevRegionRef.current, 400);
          }
          setSheetMode('confirm');
          animateSheetTo(SHEET_HEIGHT_MIN);
        }}
        onSearchAgain={() => {
          cameFromPinpointRef.current = false;
          setSheetMode('search');
          animateSheetTo(SHEET_HEIGHT);
          // Pre-fill search with street address and city only (no postal code)
          if (lastReverse?.streetLine && lastReverse?.city) {
            setSearchQuery(`${lastReverse.streetLine}, ${lastReverse.city}`);
          } else if (lastReverse?.formatted) {
            // Fallback: use formatted but try to clean it
            const cleaned = lastReverse.formatted.split(',').slice(0, 2).join(', ');
            setSearchQuery(cleaned);
          }
        }}
        onConfirm={async () => {
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

            if (user) {
              if (editingAddressIdRef.current) {
                // Update existing address
                const { data: updatedAddress, error: updateError } = await addressService.updateAddress(
                  editingAddressIdRef.current,
                  {
                    title: selectedTitle || undefined,
                    street_address: streetAddress,
                    city,
                    region,
                    latitude: center.latitude,
                    longitude: center.longitude,
                    landmark: landmark.trim() || undefined,
                    formatted_address: formatted || undefined,
                  }
                );

                if (updateError) {
                  // Silent fail - continue anyway
                }
              } else {
                // Create new address
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
                  // Silent fail - continue anyway
                }
              }
            }

            setSelectedAddress({ label: streetAddress, city, coords: center, isCurrent: false });
            cameFromPinpointRef.current = false; // Reset when saving
            navigation.goBack();
          } catch (_) {
            // Silent fail
          } finally {
            setIsSaving(false);
          }
        }}
        onBackFromDetails={() => {
          if (cameFromPinpointRef.current) {
            // Go back to pinpoint state (zoom already at street level)
            setSheetMode('pinpoint');
            animateSheetTo(SHEET_HEIGHT_PINPOINT);
            cameFromPinpointRef.current = false;
          } else {
            // Go back to confirm state
            setSheetMode('confirm');
            if (prevRegionRef.current) {
              setMapRegion(prevRegionRef.current);
              mapRef.current?.animateToRegion(prevRegionRef.current, 400);
            }
            animateSheetTo(SHEET_HEIGHT_MIN);
          }
        }}
      />
    </View>
  );
}
