import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface OrdersTrendIconProps {
  size?: number;
  color?: string;
}

export default function OrdersTrendIcon({ size = 28, color = '#2563eb' }: OrdersTrendIconProps) {
  const secondary = `${color}BF`; // ~75% opacity
  const tertiary = `${color}80`; // ~50% opacity

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={13} width={4} height={7} rx={1} fill={color} />
      <Rect x={10} y={9} width={4} height={11} rx={1} fill={secondary} />
      <Rect x={16} y={5} width={4} height={15} rx={1} fill={tertiary} />
      <Path
        d="M6 7.5 12 4l6 3.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

