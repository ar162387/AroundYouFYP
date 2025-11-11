import React from 'react';
import Svg, { Circle, Path, G } from 'react-native-svg';

interface AroundYouSearchIconProps {
  size?: number;
  color?: string;
}

export default function AroundYouSearchIcon({ size = 24, color = '#FFFFFF' }: AroundYouSearchIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Magnifying glass circle */}
      <Circle
        cx="10"
        cy="10"
        r="6.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      
      {/* Magnifying glass handle */}
      <Path
        d="M15 15L20 20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      
      {/* Location pin inside magnifier */}
      <G transform="translate(10, 10)">
        <Path
          d="M0 -3C-1.1 -3 -2 -2.1 -2 -1C-2 0.5 0 2.5 0 2.5C0 2.5 2 0.5 2 -1C2 -2.1 1.1 -3 0 -3Z"
          fill={color}
        />
        <Circle cx="0" cy="-1" r="0.6" fill="#1E3A8A" />
      </G>
    </Svg>
  );
}

