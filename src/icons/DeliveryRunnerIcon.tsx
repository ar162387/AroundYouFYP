import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface DeliveryRunnerIconProps {
  size?: number;
  color?: string;
}

export default function DeliveryRunnerIcon({ size = 20, color = '#3B82F6' }: DeliveryRunnerIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Running Person Silhouette - Scaled up more */}
      {/* Head */}
      <Path
        d="M12 1.5c-1.8 0-3 1.2-3 3s1.2 3 3 3 3-1.2 3-3-1.2-3-3-3z"
        fill={color}
      />
      {/* Body */}
      <Path
        d="M12 5.5v6"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left leg (forward) */}
      <Path
        d="M9.5 11.5l-3 6"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right leg (back) */}
      <Path
        d="M14.5 11.5l3 5.5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left arm (back) */}
      <Path
        d="M9 8.5l-3-2"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right arm (forward) */}
      <Path
        d="M15 8.5l3-2"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Motion lines (three horizontal lines parallel to forward slash) */}
      <Line
        x1="16"
        y1="4"
        x2="20"
        y2="1"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Line
        x1="16"
        y1="6.5"
        x2="20"
        y2="3.5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Line
        x1="16"
        y1="9"
        x2="20"
        y2="6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </Svg>
  );
}

