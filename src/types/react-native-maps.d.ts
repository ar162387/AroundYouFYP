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
    initialRegion?: Region;
    scrollEnabled?: boolean;
    rotateEnabled?: boolean;
    pitchEnabled?: boolean;
    zoomEnabled?: boolean;
    children?: ReactNode;
  }

  export default class MapView extends Component<MapViewProps> {}

  export interface MarkerProps {
    coordinate: { latitude: number; longitude: number };
    pinColor?: string;
  }
  export class Marker extends Component<MarkerProps> {}
}


