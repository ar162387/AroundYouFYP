import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export default function SearchIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6" stroke={color} strokeWidth={2} />
      <Path d="M16 16l4.5 4.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}


