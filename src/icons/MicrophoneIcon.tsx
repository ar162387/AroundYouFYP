import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface MicrophoneIconProps {
  size?: number;
  color?: string;
  isRecording?: boolean;
}

export default function MicrophoneIcon({ size = 24, color = '#FFFFFF', isRecording = false }: MicrophoneIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
        fill={isRecording ? '#ef4444' : color}
        opacity={isRecording ? 1 : 0.9}
      />
      <Path
        d="M19 10v1a7 7 0 0 1-14 0v-1"
        stroke={isRecording ? '#ef4444' : color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M12 19v4M8 23h8"
        stroke={isRecording ? '#ef4444' : color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {isRecording && (
        <Circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth={1.5} fill="none" opacity={0.3} />
      )}
    </Svg>
  );
}

