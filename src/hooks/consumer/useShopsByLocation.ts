import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocationSelection } from '../../context/LocationContext';
import { useUserLocation } from './useUserLocation';
import { findShopsByLocation } from '../../services/consumer/shopService';
import { calculateShopsDeliveryFees } from '../../services/consumer/deliveryFeeService';
import type { ConsumerShop } from '../../services/consumer/shopService';
import { onForegroundResume, onNetworkRestored } from '../../utils/appLifecycleEvents';

export function useShopsByLocation() {
  const { selectedAddress } = useLocationSelection();
  const { coords: userCoords } = useUserLocation();
  const [shops, setShops] = useState<ConsumerShop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Determine which coordinates to use (priority: selectedAddress.coords > userCoords)
  const coords = useMemo(() => {
    const result = selectedAddress?.coords || userCoords;
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:20',message:'Coords computed',data:{hasSelectedAddress:!!selectedAddress?.coords,hasUserCoords:!!userCoords,result:result?`${result.latitude},${result.longitude}`:null},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return result;
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
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:38',message:'fetchShops called',data:{forceRefresh,hasCoords:!!coords,coordsKey,lastFetchedCoords:lastFetchedCoordsRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion
    if (!coords || !coords.latitude || !coords.longitude) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:39',message:'No coords available - early return',data:{coords:coords?`${coords.latitude},${coords.longitude}`:null},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,E'})}).catch(()=>{});
      // #endregion
      if (isMountedRef.current) {
        setShops([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    // Skip if we already fetched for these exact coordinates (unless force refresh)
    if (!forceRefresh && lastFetchedCoordsRef.current === coordsKey) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:48',message:'Duplicate fetch prevented',data:{coordsKey,lastFetchedCoords:lastFetchedCoordsRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return;
    }

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:55',message:'Starting API call',data:{coords:coords?`${coords.latitude},${coords.longitude}`:null},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion
    try {
      const result = await findShopsByLocation(coords.latitude, coords.longitude);

      if (!isMountedRef.current) return;

      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:62',message:'API call completed',data:{hasError:!!result.error,errorMessage:result.error?.message,shopsCount:result.data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
      if (result.error) {
        console.error('Error fetching shops:', result.error);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:65',message:'API error - setting error state',data:{errorMessage:result.error.message,errorCode:result.error.code,willClearLastFetched:false},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D,E'})}).catch(()=>{});
        // #endregion
        setError(result.error.message || 'Failed to fetch shops');
        setShops([]);
      } else {
        const shopsData = result.data || [];
        
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
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:105',message:'Exception in fetchShops',data:{errorMessage:err?.message,errorName:err?.name,willClearLastFetched:false},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B,C,D,E'})}).catch(()=>{});
      // #endregion
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

  // Listen for app lifecycle events (foreground resume, network restored)
  // This replaces the old connection reset polling which caused infinite loops
  useEffect(() => {
    const handleRefresh = () => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:155',message:'Lifecycle event triggered refetch',data:{hasCoords:!!coords,isMounted:isMountedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B,C'})}).catch(()=>{});
      // #endregion
      console.log('[useShopsByLocation] Lifecycle event triggered, refetching shops...');
      lastFetchedCoordsRef.current = null; // Clear to force refetch
      if (coords && isMountedRef.current) {
        fetchShops(true);
      }
    };
    
    // Subscribe to both foreground resume and network restored events
    const unsubscribeForeground = onForegroundResume(handleRefresh);
    const unsubscribeNetwork = onNetworkRestored(handleRefresh);
    
    return () => {
      unsubscribeForeground();
      unsubscribeNetwork();
    };
  }, [coords, fetchShops]);

  useEffect(() => {
    isMountedRef.current = true;
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useShopsByLocation.ts:175',message:'Initial fetch effect triggered',data:{coordsKey,hasCoords:!!coords},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion
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

