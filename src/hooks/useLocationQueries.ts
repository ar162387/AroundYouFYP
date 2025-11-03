import { useQuery } from 'react-query';
import Config from 'react-native-config';

const GEOAPIFY_KEY = Config.GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  coords: { latitude: number; longitude: number };
}

export interface ReverseGeocodeResult {
  formatted: string;
  city?: string;
  region?: string;
  streetLine?: string;
}

// Geoapify autocomplete search
export function useGeoapifyAutocomplete(query: string, enabled: boolean = true, userCoords?: { latitude: number; longitude: number }) {
  return useQuery<SearchResult[]>(
    ['geocode', 'autocomplete', query],
    async () => {
      if (!query || query.trim().length < 2) return [];

      const bias = userCoords ? `&bias=proximity:${userCoords.longitude},${userCoords.latitude}` : '';
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=10&format=json${bias}&apiKey=${GEOAPIFY_KEY}`;
      
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any,
      });
      const json = await res.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      
      return results.map((r: any, idx: number) => {
        const name = r?.name || r?.address_line1 || r?.street || r?.formatted?.split(',')?.[0] || query;
        const address = r?.formatted || [r?.address_line1, r?.address_line2].filter(Boolean).join(', ');
        return {
          id: r?.place_id ? String(r.place_id) : `${r?.lat}-${r?.lon}-${idx}`,
          name,
          address: address || name,
          coords: { latitude: Number(r?.lat), longitude: Number(r?.lon) },
        };
      });
    },
    {
      enabled: enabled && query.trim().length >= 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

// Reverse geocoding
export function useReverseGeocode(
  coords: { latitude: number; longitude: number } | null,
  enabled: boolean = true
) {
  return useQuery<ReverseGeocodeResult | null>(
    ['geocode', 'reverse', coords?.latitude, coords?.longitude],
    async () => {
      if (!coords) return null;

      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&apiKey=${GEOAPIFY_KEY}`;
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
        
        return {
          formatted: full,
          city: (city || district || '') as string,
          region: (state || '') as string,
          streetLine,
        };
      }
      
      return null;
    },
    {
      enabled: enabled && coords !== null,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

