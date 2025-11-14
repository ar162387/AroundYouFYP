import React from 'react';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';

export interface OrderStatusIconProps {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export function OrderPendingIcon({
  size = 72,
  primaryColor = '#0EA5E9',
  secondaryColor = '#BAE6FD',
}: OrderStatusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <Circle cx="40" cy="40" r="36" fill={secondaryColor} opacity={0.32} />
      <Circle
        cx="40"
        cy="40"
        r="24"
        stroke={primaryColor}
        strokeWidth="4"
        strokeDasharray="6 8"
        strokeLinecap="round"
      />
      <Path
        d="M40 24v16l10 6"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="40" cy="40" r="6" fill={primaryColor} />
    </Svg>
  );
}

export function OrderConfirmedIcon({
  size = 72,
  primaryColor = '#22C55E',
  secondaryColor = '#BBF7D0',
}: OrderStatusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <Circle cx="40" cy="40" r="36" fill={secondaryColor} opacity={0.32} />
      <Path
        d="M26 35c0-9 6.5-15 14-15s14 6 14 15"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M24 38h32l-4 24H28l-4-24z"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="white"
      />
      <Path
        d="M32 47l6 6 10-10"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function OrderOutForDeliveryIcon({
  size = 72,
  primaryColor = '#6366F1',
  secondaryColor = '#E0E7FF',
}: OrderStatusIconProps) {
  const runnerSize = size * 0.65;
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <Circle cx="40" cy="40" r="36" fill={secondaryColor} opacity={0.32} />
      <G transform={`translate(${(80 - runnerSize) / 2} ${(80 - runnerSize) / 2}) scale(${runnerSize / 24})`}>
        <Path
          d="M12 1.5c-1.8 0-3 1.2-3 3s1.2 3 3 3 3-1.2 3-3-1.2-3-3-3z"
          fill={primaryColor}
        />
        <Path
          d="M12 5.5v6"
          stroke={primaryColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9.5 11.5l-3 6"
          stroke={primaryColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M14.5 11.5l3 5.5"
          stroke={primaryColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9 8.5l-3-2"
          stroke={primaryColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M15 8.5l3-2"
          stroke={primaryColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line
          x1="16"
          y1="4"
          x2="20"
          y2="1"
          stroke={primaryColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <Line
          x1="16"
          y1="6.5"
          x2="20"
          y2="3.5"
          stroke={primaryColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <Line
          x1="16"
          y1="9"
          x2="20"
          y2="6"
          stroke={primaryColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </G>
    </Svg>
  );
}

export function OrderDeliveredIcon({
  size = 72,
  primaryColor = '#F59E0B',
  secondaryColor = '#FDE68A',
}: OrderStatusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <Circle cx="40" cy="40" r="36" fill={secondaryColor} opacity={0.32} />
      <Rect
        x="22"
        y="32"
        width="36"
        height="26"
        rx="6"
        fill="white"
        stroke={primaryColor}
        strokeWidth="4"
      />
      <Path
        d="M22 40h36"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path
        d="M33 33l7 9 7-9"
        fill={primaryColor}
      />
      <Path
        d="M30 47l8 8 14-14"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function OrderCancelledIcon({
  size = 72,
  primaryColor = '#EF4444',
  secondaryColor = '#FECACA',
}: OrderStatusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <Circle cx="40" cy="40" r="36" fill={secondaryColor} opacity={0.32} />
      <Circle cx="40" cy="40" r="24" stroke={primaryColor} strokeWidth="4" />
      <Path
        d="M30 30l20 20"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path
        d="M50 30L30 50"
        stroke={primaryColor}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </Svg>
  );
}


