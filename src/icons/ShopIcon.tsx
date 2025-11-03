import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export default function ShopIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shop building */}
      <Path
        d="M3 21h18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 21V7l7-5 7 5v14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Door */}
      <Path
        d="M9 21v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Window left */}
      <Rect
        x="5"
        y="10"
        width="3"
        height="3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Window right */}
      <Rect
        x="16"
        y="10"
        width="3"
        height="3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

