import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function FavoriteIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7-4.534-9-8.5C1.5 8.5 3.5 6 6 6c1.77 0 3 .9 4 2 1-1.1 2.23-2 4-2 2.5 0 4.5 2.5 3 5.5-2 3.966-9 8.5-9 8.5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}


