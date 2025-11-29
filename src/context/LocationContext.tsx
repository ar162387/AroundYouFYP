import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocationStore } from '../stores/locationStore';

export type Coordinates = { latitude: number; longitude: number };

export type SelectedAddress = {
  label: string; // e.g., "Ambasoft Street 14"
  city: string; // e.g., "Lahore"
  coords?: Coordinates | null;
  isCurrent?: boolean; // true if derived from GPS
  addressId?: string;
  landmark?: string | null;
};

type LocationContextValue = {
  selectedAddress: SelectedAddress | null;
  setSelectedAddress: (addr: SelectedAddress | null) => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);
  const setConfirmedLocation = useLocationStore((state) => state.setConfirmedLocation);

  // Initialize from Zustand store - restore synchronously if available
  const getInitialAddress = (): SelectedAddress | null => {
    if (confirmedLocation && confirmedLocation.coords) {
      return {
        label: confirmedLocation.streetLine || confirmedLocation.address || 'Selected location',
        city: confirmedLocation.city || '',
        coords: confirmedLocation.coords,
        isCurrent: false,
        landmark: null,
      };
    }
    return null;
  };

  const [selectedAddress, setSelectedAddressState] = useState<SelectedAddress | null>(getInitialAddress);

  // Also restore on mount in case store hydrates after initial render
  useEffect(() => {
    if (confirmedLocation && confirmedLocation.coords && !selectedAddress) {
      const restoredAddress: SelectedAddress = {
        label: confirmedLocation.streetLine || confirmedLocation.address || 'Selected location',
        city: confirmedLocation.city || '',
        coords: confirmedLocation.coords,
        isCurrent: false,
        landmark: null,
      };
      setSelectedAddressState(restoredAddress);
    }
  }, [confirmedLocation, selectedAddress]);

  // Wrapper to persist address when it's set
  const setSelectedAddress = useCallback((addr: SelectedAddress | null) => {
    setSelectedAddressState(addr);
    
    // Persist to locationStore if address has coordinates
    if (addr && addr.coords) {
      setConfirmedLocation({
        coords: addr.coords,
        address: addr.label,
        streetLine: addr.label,
        city: addr.city || '',
        timestamp: Date.now(),
      });
    }
  }, [setConfirmedLocation]);

  const value = useMemo(() => ({ selectedAddress, setSelectedAddress }), [selectedAddress, setSelectedAddress]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationSelection(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationSelection must be used within LocationProvider');
  return ctx;
}


