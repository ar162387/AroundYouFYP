export type LatLngLiteral = {
  latitude: number;
  longitude: number;
};

export type DeliveryArea = {
  id: string;
  shopId: string;
  label: string;
  coordinates: LatLngLiteral[];
  createdAt: string;
  updatedAt: string;
};

export type DeliveryAreaPayload = {
  label?: string;
  coordinates: LatLngLiteral[];
};


