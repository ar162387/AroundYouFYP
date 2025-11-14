import React, { useMemo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type LocationMarkerIconProps = {
  size?: number;
  color?: string;
  innerColor?: string;
  accentColor?: string;
};

export default function LocationMarkerIcon({
  size = 24,
  color = '#2563EB',
  innerColor = '#FFFFFF',
  accentColor = 'rgba(255, 255, 255, 0.28)',
}: LocationMarkerIconProps) {
  // Ensures crisp rendering across different sizes
  const scale = useMemo(() => size / 32, [size]);

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Outer marker */}
      <Path
        d="M16 1.75c-6.109 0-11.062 4.953-11.062 11.062 0 7.45 8.462 17.645 10.348 19.809a1 1 0 0 0 1.43.067l.067-.067c1.886-2.164 10.348-12.359 10.348-19.809 0-6.109-4.953-11.062-11.062-11.062Z"
        fill={color}
      />

      {/* Soft highlight */}
      <Path
        d="M16 3.75c-4.998 0-9.062 4.064-9.062 9.062 0 5.846 5.784 13.969 9.062 17.959 3.278-3.99 9.062-12.113 9.062-17.959 0-4.998-4.064-9.062-9.062-9.062Z"
        fill={accentColor}
      />

      {/* Inner ring */}
      <Circle
        cx={16}
        cy={12.5}
        r={5.5}
        fill="none"
        stroke={innerColor}
        strokeOpacity={0.45}
        strokeWidth={2 * scale}
      />

      {/* Inner circle */}
      <Circle cx={16} cy={12.5} r={4} fill={innerColor} />

      {/* Tail smoothing (subtle base flare) */}
      <Path
        d="M16 26.5c-1.932 0-3.985 1.236-3.985 2.78 0 .852.676 1.544 1.51 1.544h4.952c.834 0 1.51-.692 1.51-1.543 0-1.545-2.053-2.781-3.987-2.781Z"
        fill="rgba(0, 0, 0, 0.08)"
      />
    </Svg>
  );
}


