import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export default function CartIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shopping bag body */}
      <Path
        d="M6 6h12l2 13H4L6 6z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Shopping bag handles */}
      <Path
        d="M9 6V5a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* AroundYou theme - shopping items dots */}
      <Circle cx="9" cy="11" r="1" fill={color} />
      <Circle cx="12" cy="11" r="1" fill={color} />
      <Circle cx="15" cy="11" r="1" fill={color} />
    </Svg>
  );
}


