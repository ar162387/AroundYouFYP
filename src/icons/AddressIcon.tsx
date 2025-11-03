import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export default function AddressIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Pin marker with smooth teardrop shape */}
      <Path
        d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
        fill={color}
      />
      {/* Inner white circle for contrast */}
      <Circle cx="12" cy="9" r="3" fill="#ffffff" />
    </Svg>
  );
}

