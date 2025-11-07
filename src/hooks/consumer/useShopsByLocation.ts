import { useEffect, useState } from 'react';
import { useLocationSelection } from '../../context/LocationContext';
import { useUserLocation } from './useUserLocation';
import { findShopsByLocation } from '../../services/consumer/shopService';
import type { ConsumerShop } from '../../services/consumer/shopService';

export function useShopsByLocation() {
  const { selectedAddress } = useLocationSelection();
  const { coords: userCoords } = useUserLocation();
  const [shops, setShops] = useState<ConsumerShop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchShops = async () => {
      // Determine which coordinates to use
      // Priority: selectedAddress.coords > userCoords
      const coords = selectedAddress?.coords || userCoords;

      if (!coords || !coords.latitude || !coords.longitude) {
        if (isMounted) {
          setShops([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        console.log('Fetching shops for location:', { latitude: coords.latitude, longitude: coords.longitude });
        const result = await findShopsByLocation(coords.latitude, coords.longitude);
        console.log('Shop fetch result:', { shopsCount: result.data?.length || 0, error: result.error });

        if (!isMounted) return;

        if (result.error) {
          console.error('Error fetching shops:', result.error);
          setError(result.error.message || 'Failed to fetch shops');
          setShops([]);
        } else {
          console.log('Setting shops:', result.data?.length || 0);
          setShops(result.data || []);
          setError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Exception fetching shops:', err);
        setError(err?.message || 'An error occurred');
        setShops([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchShops();

    return () => {
      isMounted = false;
    };
  }, [selectedAddress?.coords?.latitude, selectedAddress?.coords?.longitude, userCoords?.latitude, userCoords?.longitude]);

  return { shops, loading, error };
}

