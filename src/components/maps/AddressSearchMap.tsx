import React from 'react';
import { Platform, Animated, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import PinMarker from '../../icons/PinMarker';
import CenterHairline from '../../icons/CenterHairline';

export interface AddressSearchMapProps {
  mapRef: React.RefObject<any>;
  initialRegion: Region;
  onTouchStart: () => void;
  onRegionChangeComplete: (region: any) => void;
  onTouchEnd: () => void;
  onAndroidResponderMove: () => void;
  isMoving: boolean;
  markerOffsetY: Animated.Value;
}

export default function AddressSearchMap({
  mapRef,
  initialRegion,
  onTouchStart,
  onRegionChangeComplete,
  onTouchEnd,
  onAndroidResponderMove,
  isMoving,
  markerOffsetY,
}: AddressSearchMapProps) {
  return (
    <>
      {/* Map View */}
      {Platform.OS === 'ios' ? (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onTouchStart={onTouchStart}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
          onTouchEnd={onTouchEnd}
        />
      ) : (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          onTouchStart={onTouchStart}
          onMoveShouldSetResponder={() => true}
          onResponderMove={onAndroidResponderMove}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
          onTouchEnd={onTouchEnd}
        />
      )}

      {/* Centered Blue Marker with hairline when moving */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: [
            { translateX: -18 },
            { translateY: -36 },
            { translateY: markerOffsetY },
          ],
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <PinMarker size={36} color="#3B82F6" />
          {isMoving && (
            <View style={{ marginTop: 2 }}>
              <CenterHairline height={22} color="#3B82F6" opacity={0.9} strokeWidth={1.5} dashArray="2,2" />
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

