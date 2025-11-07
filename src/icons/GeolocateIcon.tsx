import React from 'react';
import Svg, { Circle } from 'react-native-svg';

type GeolocateIconProps = {
  size?: number;
  color?: string;
};

export default function GeolocateIcon({ size = 24, color = '#ffffff' }: GeolocateIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer circle */}
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      {/* Inner circle */}
      <Circle
        cx="12"
        cy="12"
        r="5"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      {/* Center dot */}
      <Circle
        cx="12"
        cy="12"
        r="1.5"
        fill={color}
      />
    </Svg>
  );
}

