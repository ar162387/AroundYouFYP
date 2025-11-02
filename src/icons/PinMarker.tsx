import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type PinMarkerProps = {
  size?: number;
  color?: string;
};

export default function PinMarker({ size = 36, color = '#3B82F6' }: PinMarkerProps) {
  // Simple pin shape with inner dot
  // viewBox 24 for scaling clarity
  const scale = size / 24;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Pin body */}
      <Path
        d="M12 2c-3.314 0-6 2.686-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z"
        fill={color}
      />
      {/* Inner dot */}
      <Circle cx="12" cy="8" r={2.5} fill="#ffffff" />
    </Svg>
  );
}


