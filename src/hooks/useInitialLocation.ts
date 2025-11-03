import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useLocationStore } from '../stores/locationStore';
import { useAuth } from '../context/AuthContext';
import type { Coordinates } from '../context/LocationContext';

/**
 * Hook to determine initial location on app start
 * Priority:
 * 1. If authenticated + stored confirmed location exists → use stored location
 * 2. If unauthenticated → fallback to current GPS location
 * 3. If GPS unavailable → use stored manual address from first launch
 */
export function useInitialLocation(): {
  location: Coordinates | null;
  loading: boolean;
  error: string | null;
} {
  const { user } = useAuth();
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadInitialLocation = async () => {
      setLoading(true);
      setError(null);

      try {
        // Priority 1: If authenticated and has stored location, use it
        if (user && confirmedLocation) {
          if (isMounted) {
            setLocation(confirmedLocation.coords);
            setLoading(false);
          }
          return;
        }

        // Priority 2: Try to get current GPS location (for unauthenticated users)
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            // Priority 3: Fallback to stored manual address
            if (isMounted && confirmedLocation) {
              setLocation(confirmedLocation.coords);
              setLoading(false);
              return;
            }
            if (isMounted) {
              setError('Location permission denied');
              setLoading(false);
            }
            return;
          }
        }

        const position = await new Promise<Coordinates | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 3000);
          Geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeout);
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
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
            setLocation(position);
          } else {
            // Priority 3: Fallback to stored manual address
            if (confirmedLocation) {
              setLocation(confirmedLocation.coords);
            } else {
              setError('Unable to get location');
            }
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to get location');
          // Final fallback to stored location
          if (confirmedLocation) {
            setLocation(confirmedLocation.coords);
          }
          setLoading(false);
        }
      }
    };

    loadInitialLocation();

    return () => {
      isMounted = false;
    };
  }, [user, confirmedLocation]);

  return { location, loading, error };
}

