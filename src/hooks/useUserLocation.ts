import { useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';

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

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission denied');
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isMounted) return;
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });

        // Google Geocoding API first (key provided in app init)
        const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        let line: string | null = null;
        if (googleKey) {
          try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleKey}&language=en`;
            const res = await fetch(url);
            const json = await res.json();
            if (json?.status === 'OK' && Array.isArray(json.results) && json.results.length > 0) {
              const primary = json.results[0];
              // Prefer a concise label from components
              const components = primary.address_components || [];
              const streetNumber = components.find((c: any) => c.types.includes('street_number'))?.long_name;
              const route = components.find((c: any) => c.types.includes('route'))?.long_name;
              const sublocality1 = components.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name;
              const sublocality = components.find((c: any) => c.types.includes('sublocality'))?.long_name;
              const neighborhood = components.find((c: any) => c.types.includes('neighborhood'))?.long_name;
              const computedCity = components.find((c: any) => c.types.includes('locality'))?.long_name
                || components.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name;
              const region = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name;
              const part1 = [streetNumber, route].filter(Boolean).join(' ');
              line = [part1, neighborhood, city || region].filter(Boolean).join(', ')
                || primary.formatted_address
                || null;

              // Set concise place label preference order
              const concise = sublocality1 || sublocality || neighborhood || route || part1 || null;
              setPlaceLabel(concise);
              setCity(computedCity || null);
            }
          } catch (_) {
            // Ignore and fallback
          }
        }

        if (!line) {
          const results = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (!isMounted) return;
          const best = results?.[0];
          line = best
            ? [best.name, best.street, (best as any).district || (best as any).subregion, best.city, best.region]
                .filter(Boolean)
                .join(', ')
            : null;
          setPlaceLabel((best as any)?.district || (best as any)?.subregion || best?.name || null);
          setCity(best?.city || null);
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


