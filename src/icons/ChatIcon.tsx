import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ChatIconProps {
  size?: number;
  color?: string;
}

export default function ChatIcon({ size = 24, color = '#FFFFFF' }: ChatIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
        fill={color}
        opacity={0.95}
      />
      <Path
        d="M7 9h10M7 13h6"
        stroke={color === '#FFFFFF' ? 'rgba(37, 99, 235, 0.3)' : '#FFFFFF'}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M20 18l-2-2H6V4h12v14z"
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.1}
        fill="none"
      />
    </Svg>
  );
}

