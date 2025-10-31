import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

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

  const value = useMemo(() => ({ selectedAddress, setSelectedAddress }), [selectedAddress]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationSelection(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationSelection must be used within LocationProvider');
  return ctx;
}


