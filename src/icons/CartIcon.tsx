import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export default function CartIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 5h2l2 12h10l2-8H7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="10" cy="19" r="1.5" fill={color} />
      <Circle cx="17" cy="19" r="1.5" fill={color} />
    </Svg>
  );
}


