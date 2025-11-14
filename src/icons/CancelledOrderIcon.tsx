import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface CancelledOrderIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function CancelledOrderIcon({
  size = 28,
  color = '#dc2626',
  strokeWidth = 2,
}: CancelledOrderIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M9 9l6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M15 9l-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

