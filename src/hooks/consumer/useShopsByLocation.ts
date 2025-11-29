import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocationSelection } from '../../context/LocationContext';
import { useUserLocation } from './useUserLocation';
import { findShopsByLocation } from '../../services/consumer/shopService';
import { calculateShopsDeliveryFees } from '../../services/consumer/deliveryFeeService';
import type { ConsumerShop } from '../../services/consumer/shopService';
import { getConnectionResetCount } from '../../services/supabase';

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
  const lastConnectionResetCountRef = useRef<number>(0);
  
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
        
        // Calculate delivery fees for all shops with timeout protection
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Delivery fee calculation timeout'));
            }, 15000); // 15 second timeout for fee calculation
          });
          
          const shopsWithFees = await Promise.race([
            calculateShopsDeliveryFees(
              shopsData,
              coords.latitude,
              coords.longitude
            ),
            timeoutPromise,
          ]);
          
          if (isMountedRef.current) {
            setShops(shopsWithFees);
            setError(null);
            // Mark these coordinates as fetched
            lastFetchedCoordsRef.current = coordsKey;
          }
        } catch (feeError: any) {
          // If fee calculation fails or times out, still show shops without fees
          console.warn('Delivery fee calculation failed, showing shops without fees:', feeError);
          if (isMountedRef.current) {
            // Set shops with default delivery fee (0 or undefined)
            setShops(shopsData);
            setError(null);
            // Mark these coordinates as fetched
            lastFetchedCoordsRef.current = coordsKey;
          }
        }
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Exception fetching shops:', err);
      setError(err?.message || 'An error occurred');
      setShops([]);
    } finally {
      // Always clear loading state, even if there was an error or timeout
      if (isMountedRef.current) {
        setLoading(false);
      }
      // Add a safety timeout to ensure loading is cleared even if something goes wrong
      setTimeout(() => {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }, 2000);
    }
  }, [coords, coordsKey]);

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    // Clear the last fetched coords to force a refetch
    lastFetchedCoordsRef.current = null;
    await fetchShops(true);
  }, [fetchShops]);

  // Monitor connection resets and refetch when connection is restored
  useEffect(() => {
    const checkConnectionReset = setInterval(() => {
      const currentResetCount = getConnectionResetCount();
      if (currentResetCount > lastConnectionResetCountRef.current) {
        // Connection was reset, clear last fetched coords to trigger refetch
        console.log('[useShopsByLocation] Connection reset detected, triggering refetch...');
        lastConnectionResetCountRef.current = currentResetCount;
        lastFetchedCoordsRef.current = null;
        if (coords && isMountedRef.current) {
          fetchShops(true); // Force refresh
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(checkConnectionReset);
  }, [coords, fetchShops]);

  useEffect(() => {
    isMountedRef.current = true;
    lastConnectionResetCountRef.current = getConnectionResetCount();
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

