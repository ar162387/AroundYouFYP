import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { useLocationStore } from '../stores/locationStore';

export type Coordinates = { latitude: number; longitude: number };

export type SelectedAddress = {
  label: string; // e.g., "Ambasoft Street 14"
  city: string; // e.g., "Lahore"
  coords?: Coordinates | null;
  isCurrent?: boolean; // true if derived from GPS
};

type LocationContextValue = {
  selectedAddress: SelectedAddress | null;
  setSelectedAddress: (addr: SelectedAddress | null) => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);

  // Initialize from Zustand store on mount
  useEffect(() => {
    if (confirmedLocation && !selectedAddress) {
      setSelectedAddress({
        label: confirmedLocation.streetLine || confirmedLocation.address,
        city: confirmedLocation.city || '',
        coords: confirmedLocation.coords,
        isCurrent: false,
      });
    }
  }, [confirmedLocation]);

  const value = useMemo(() => ({ selectedAddress, setSelectedAddress }), [selectedAddress]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationSelection(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationSelection must be used within LocationProvider');
  return ctx;
}


