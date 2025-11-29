import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface AISparkleIconProps {
  size?: number;
  color?: string;
}

export default function AISparkleIcon({ size = 20, color = '#2563eb' }: AISparkleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill={color}
        opacity={0.9}
      />
      <Path
        d="M19 3L19.5 5.5L22 6L19.5 6.5L19 9L18.5 6.5L16 6L18.5 5.5L19 3Z"
        fill={color}
        opacity={0.7}
      />
      <Path
        d="M5 17L5.3 18.3L6.5 18.6L5.3 18.9L5 20.2L4.7 18.9L3.5 18.6L4.7 18.3L5 17Z"
        fill={color}
        opacity={0.6}
      />
    </Svg>
  );
}

