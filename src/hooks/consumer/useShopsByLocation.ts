import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocationSelection } from '../../context/LocationContext';
import { useUserLocation } from './useUserLocation';
import { findShopsByLocation } from '../../services/consumer/shopService';
import { calculateShopsDeliveryFees } from '../../services/consumer/deliveryFeeService';
import type { ConsumerShop } from '../../services/consumer/shopService';

export function useShopsByLocation() {
  const { selectedAddress } = useLocationSelection();
  const { coords: userCoords } = useUserLocation();
  const [shops, setShops] = useState<ConsumerShop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Determine which coordinates to use (priority: selectedAddress.coords > userCoords)
  const coords = useMemo(() => {
    return selectedAddress?.coords || userCoords;
  }, [
    selectedAddress?.coords?.latitude,
    selectedAddress?.coords?.longitude,
    userCoords?.latitude,
    userCoords?.longitude,
  ]);

  // Track last fetched coordinates to prevent duplicate fetches
  const lastFetchedCoordsRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  
  // Create a stable key from coordinates
  const coordsKey = coords 
    ? `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`
    : null;

  // Fetch shops function that can be called from anywhere
  const fetchShops = useCallback(async (forceRefresh = false) => {
    if (!coords || !coords.latitude || !coords.longitude) {
      if (isMountedRef.current) {
        setShops([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    // Skip if we already fetched for these exact coordinates (unless force refresh)
    if (!forceRefresh && lastFetchedCoordsRef.current === coordsKey) {
      return;
    }

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      console.log('Fetching shops for location:', { latitude: coords.latitude, longitude: coords.longitude });
      const result = await findShopsByLocation(coords.latitude, coords.longitude);
      console.log('Shop fetch result:', { shopsCount: result.data?.length || 0, error: result.error });

      if (!isMountedRef.current) return;

      if (result.error) {
        console.error('Error fetching shops:', result.error);
        setError(result.error.message || 'Failed to fetch shops');
        setShops([]);
      } else {
        const shopsData = result.data || [];
        console.log('Setting shops:', shopsData.length);
        
        // Calculate delivery fees for all shops
        const shopsWithFees = await calculateShopsDeliveryFees(
          shopsData,
          coords.latitude,
          coords.longitude
        );
        
        if (isMountedRef.current) {
          setShops(shopsWithFees);
          setError(null);
          // Mark these coordinates as fetched
          lastFetchedCoordsRef.current = coordsKey;
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Exception fetching shops:', err);
      setError(err?.message || 'An error occurred');
      setShops([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [coords, coordsKey]);

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    // Clear the last fetched coords to force a refetch
    lastFetchedCoordsRef.current = null;
    await fetchShops(true);
  }, [fetchShops]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchShops();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchShops]);

  return { 
    shops, 
    loading, 
    error,
    refetch,
  };
}

