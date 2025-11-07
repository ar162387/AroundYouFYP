declare module 'react-native-maps' {
  import { Component, ReactNode } from 'react';
  import { ViewProps } from 'react-native';

  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface LatLng {
    latitude: number;
    longitude: number;
  }

  export interface MapPressEvent {
    nativeEvent: {
      coordinate: LatLng;
    };
  }

  export interface MapViewProps extends ViewProps {
    provider?: any;
    initialRegion?: Region;
    region?: Region;
    onRegionChangeComplete?: (region: Region) => void;
    onPanDrag?: (e: any) => void;
    onPress?: (e: MapPressEvent) => void;
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
    moveOnMarkerPress?: boolean;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    onStartShouldSetResponderCapture?: () => boolean;
    onMoveShouldSetResponderCapture?: () => boolean;
    children?: ReactNode;
  }

  export default class MapView extends Component<MapViewProps> {
    animateToRegion(region: Region, duration?: number): void;
    animateToCoordinate(coordinate: { latitude: number; longitude: number }, duration?: number): void;
    coordinateForPoint(point: { x: number; y: number }): Promise<LatLng>;
  }

  export interface MarkerDragEvent {
    nativeEvent: {
      coordinate: LatLng;
      position: { x: number; y: number };
    };
  }

  export interface MarkerDragStartEndEvent {
    nativeEvent: {
      coordinate: LatLng;
      position: { x: number; y: number };
    };
  }

  export interface MarkerPressEvent {
    nativeEvent: {
      coordinate: LatLng;
      position: { x: number; y: number };
    };
    stopPropagation?: () => void;
  }

  export interface MarkerProps extends ViewProps {
    coordinate: LatLng;
    title?: string;
    description?: string;
    pinColor?: string;
    zIndex?: number;
    tracksViewChanges?: boolean;
    draggable?: boolean;
    anchor?: { x: number; y: number };
    onPress?: (e: MarkerPressEvent) => void;
    onDragStart?: (e: MarkerDragStartEndEvent) => void;
    onDrag?: (e: MarkerDragEvent) => void;
    onDragEnd?: (e: MarkerDragStartEndEvent) => void;
  }

  export class Marker extends Component<MarkerProps> {}

  export interface PolygonPressEvent {
    nativeEvent: {
      coordinate: LatLng;
    };
    stopPropagation?: () => void;
  }

  export interface PolygonProps extends ViewProps {
    coordinates: LatLng[];
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    tappable?: boolean;
    onPress?: (event: PolygonPressEvent) => void;
    key?: string | number | null;
  }

  export class Polygon extends Component<PolygonProps> {}

  export interface PolylineProps extends ViewProps {
    coordinates: LatLng[];
    strokeColor?: string;
    strokeWidth?: number;
    lineDashPattern?: number[];
  }

  export class Polyline extends Component<PolylineProps> {}

  export const PROVIDER_GOOGLE: any;
}


