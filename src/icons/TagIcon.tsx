import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface TagIconProps {
  size?: number;
  color?: string;
}

export default function TagIcon({ size = 20, color = '#F59E0B' }: TagIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="7"
        cy="7"
        r="1.5"
        fill={color}
      />
    </Svg>
  );
}

