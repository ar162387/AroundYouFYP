declare module 'react-native-maps' {
  import { Component, ReactNode } from 'react';
  import { ViewProps } from 'react-native';

  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface MapViewProps extends ViewProps {
    provider?: any;
    initialRegion?: Region;
    region?: Region;
    onRegionChangeComplete?: (region: Region) => void;
    onPanDrag?: (e: any) => void;
    onPress?: (e: any) => void;
    onMapReady?: () => void;
    onError?: (error: any) => void;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    loadingEnabled?: boolean;
    loadingIndicatorColor?: string;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    scrollEnabled?: boolean;
    rotateEnabled?: boolean;
    pitchEnabled?: boolean;
    zoomEnabled?: boolean;
    children?: ReactNode;
  }

  export default class MapView extends Component<MapViewProps> {
    animateToRegion(region: Region, duration?: number): void;
    animateToCoordinate(coordinate: { latitude: number; longitude: number }, duration?: number): void;
  }

  export const PROVIDER_GOOGLE: any;
}


