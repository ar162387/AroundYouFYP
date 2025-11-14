import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface RevenueFlowIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function RevenueFlowIcon({
  size = 28,
  color = '#16a34a',
  strokeWidth = 1.8,
}: RevenueFlowIconProps) {
  const fill = `${color}15`;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={fill} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9 16v-8h4a2 2 0 0 1 0 4H9m0 0h3.2L15 16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 12h4.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

