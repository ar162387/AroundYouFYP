import React, { useMemo } from 'react';
import { Dimensions, View, Text } from 'react-native';
import Svg, { Path, Circle, Polyline, Defs, LinearGradient, Stop } from 'react-native-svg';

type ChartPoint = {
  label: string;
  value: number;
};

type OrdersRevenueLineChartProps = {
  data: ChartPoint[];
  xLabels: string[];
  yLabels: number[];
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CHART_HORIZONTAL_PADDING = 8;
const CHART_VERTICAL_PADDING = 12;
const CHART_HEIGHT = 160;
const AXIS_LABEL_GUTTER = 50;

function createSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) {
    return '';
  }

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const previous = points[i - 1] ?? current;
    const nextNext = points[i + 2] ?? next;

    const controlPoint1X = current.x + (next.x - previous.x) / 6;
    const controlPoint1Y = current.y + (next.y - previous.y) / 6;
    const controlPoint2X = next.x - (nextNext.x - current.x) / 6;
    const controlPoint2Y = next.y - (nextNext.y - current.y) / 6;

    d += ` C${controlPoint1X},${controlPoint1Y} ${controlPoint2X},${controlPoint2Y} ${next.x},${next.y}`;
  }

  return d;
}

export default function OrdersRevenueLineChart({ data, xLabels, yLabels }: OrdersRevenueLineChartProps) {
  const { linePath, areaPath, points, maxValue, chartWidth } = useMemo(() => {
    if (!data.length) {
      return {
        linePath: '',
        areaPath: '',
        points: [] as { x: number; y: number }[],
        maxValue: 0,
        chartWidth: SCREEN_WIDTH - 160, // Account for padding and y-axis
      };
    }

    // Calculate available width considering padding and y-axis labels
    const containerPadding = 120; // Combined padding from all containers
    const maxAllowedWidth = SCREEN_WIDTH - containerPadding - AXIS_LABEL_GUTTER;
    const calculatedWidth = Math.max(200, maxAllowedWidth);
    
    // Use the max value from yLabels if provided, otherwise calculate from data
    const max = yLabels.length > 0 ? Math.max(...yLabels) : Math.max(...data.map((point) => point.value));
    const safeMax = max === 0 ? 1 : max;
    const stepX = data.length > 1 ? calculatedWidth / (data.length - 1) : 0;

    const transformPoint = (value: number, index: number) => {
      const x = CHART_HORIZONTAL_PADDING + index * stepX;
      const y = CHART_VERTICAL_PADDING + (1 - value / safeMax) * CHART_HEIGHT;
      return { x, y };
    };

    const computedPoints = data.map((point, index) => transformPoint(point.value, index));
    const smoothLine = createSmoothPath(computedPoints);
    const baselineY = CHART_VERTICAL_PADDING + CHART_HEIGHT;
    const area = smoothLine
      ? `${smoothLine} L${computedPoints[computedPoints.length - 1].x},${baselineY} L${computedPoints[0].x},${baselineY} Z`
      : '';

    return {
      linePath: smoothLine,
      areaPath: area,
      points: computedPoints,
      maxValue: safeMax,
      chartWidth: calculatedWidth,
    };
  }, [data, yLabels]);

  const svgWidth = chartWidth + CHART_HORIZONTAL_PADDING * 2;

  return (
    <View>
      <View className="flex-row items-stretch">
        <Svg width={svgWidth} height={CHART_HEIGHT + CHART_VERTICAL_PADDING * 2}>
          <Defs>
            <LinearGradient id="ordersRevenueGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#2563eb" stopOpacity="0.28" />
              <Stop offset="1" stopColor="#2563eb" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = CHART_VERTICAL_PADDING + fraction * CHART_HEIGHT;
            return (
              <Polyline
                key={fraction}
                points={`${CHART_HORIZONTAL_PADDING},${y} ${svgWidth - CHART_HORIZONTAL_PADDING},${y}`}
                stroke="#dbeafe"
                strokeWidth={1}
              />
            );
          })}

          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const x = CHART_HORIZONTAL_PADDING + fraction * chartWidth;
            return (
              <Polyline
                key={`v-${fraction}`}
                points={`${x},${CHART_VERTICAL_PADDING} ${x},${CHART_VERTICAL_PADDING + CHART_HEIGHT}`}
                stroke="#eff6ff"
                strokeWidth={1}
              />
            );
          })}

          {areaPath ? <Path d={areaPath} fill="url(#ordersRevenueGradient)" /> : null}
          {linePath ? <Path d={linePath} stroke="#1d4ed8" strokeWidth={3} fill="none" /> : null}

        </Svg>
        <View className="justify-between ml-2" style={{ width: AXIS_LABEL_GUTTER }}>
          {[...yLabels].reverse().map((label, index) => {
            // Format large numbers (e.g., 10000 -> 10k)
            const formattedLabel = label >= 1000 
              ? `${(label / 1000).toFixed(label % 1000 === 0 ? 0 : 1)}k` 
              : label.toString();
            
            return (
              <Text key={`${label}-${index}`} className="text-xs text-gray-500 font-medium">
                {formattedLabel}
              </Text>
            );
          })}
        </View>
      </View>

      <View className="flex-row justify-between px-2 mt-3">
        {xLabels.map((label) => (
          <Text key={label} className="text-xs text-gray-500">
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

