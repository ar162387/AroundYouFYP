import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface MoneyIconProps {
  size?: number;
  color?: string;
}

export default function MoneyIcon({ size = 20, color = '#10B981' }: MoneyIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M12 6v12M15 9h-4.5a1.5 1.5 0 100 3h3a1.5 1.5 0 010 3H9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

