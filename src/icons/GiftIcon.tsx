import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface GiftIconProps {
  size?: number;
  color?: string;
}

export default function GiftIcon({ size = 20, color = '#EC4899' }: GiftIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="8"
        width="18"
        height="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect
        x="3"
        y="12"
        width="18"
        height="9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 8V21M7.5 8a2.5 2.5 0 110-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 100-5C13 3 12 8 12 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

