import { useEffect, useMemo, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import Config from 'react-native-config';

export type UserLocationState = {
  addressLine: string | null;
  coords: { latitude: number; longitude: number } | null;
  loading: boolean;
  error: string | null;
  placeLabel?: string | null; // concise neighborhood/sector label
  city?: string | null;
};

export function useUserLocation(): UserLocationState {
  const [addressLine, setAddressLine] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Request location permission (Platform-specific)
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs access to your location',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error('Location permission denied');
          }
        }
        // iOS permissions are handled in Info.plist

        // Get current position with shorter timeout
        const position = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
          );
        });

        if (!isMounted) return;
        const { latitude, longitude } = position;
        setCoords({ latitude, longitude });

        // Use Geoapify Reverse Geocoding API (faster and no Google billing)
        const geoapifyKey = Config.GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
        let line: string | null = null;
        try {
          const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&format=json&apiKey=${geoapifyKey}`;
          const res = await fetch(url, { 
            headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any 
          });
          const json = await res.json();
          if (json?.results?.length > 0) {
            const result = json.results[0];
            const street = result?.street || '';
            const houseNumber = result?.housenumber || '';
            const district = result?.district || result?.suburb || '';
            const neighborhood = district || result?.neighbourhood || '';
            const computedCity = result?.city || '';
            const state = result?.state || '';
            
            // Build address line
            const part1 = [houseNumber, street].filter(Boolean).join(' ');
            line = [part1, neighborhood, computedCity, state].filter(Boolean).join(', ')
              || result?.formatted
              || null;

            // Set concise place label (prefer district/suburb/neighborhood)
            const concise = district || neighborhood || street || part1 || null;
            setPlaceLabel(concise);
            setCity(computedCity || null);
          }
        } catch (_) {
          // Silent fail - coords are still available
        }

        setAddressLine(line);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'Failed to fetch location');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return useMemo(
    () => ({ addressLine, coords, loading, error, placeLabel, city }),
    [addressLine, coords, loading, error, placeLabel, city]
  );
}


