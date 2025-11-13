import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export default function MarketIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Store awning/roof */}
      <Path
        d="M3 8l2-5h14l2 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Store front curved bottom */}
      <Path
        d="M3 8v1c0 1.1.9 2 2 2 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 1.1 0 2-.9 2-2 0 1.1.9 2 2 2 1.1 0 2-.9 2-2V8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Store building */}
      <Path
        d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Door */}
      <Path
        d="M10 21v-6h4v6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

