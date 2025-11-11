import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export default function CategoryItemsSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E5E7EB',
          borderRadius: 8,
          opacity: shimmerOpacity,
        },
        style,
      ]}
    />
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Items Grid Skeleton */}
      <View className="flex-row flex-wrap p-3" style={{ justifyContent: 'space-between' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <View key={i} className="items-center mb-3" style={{ width: '48%' }}>
            <SkeletonBox width={140} height={140} style={{ borderRadius: 16 }} />
            <View className="mt-3 w-full">
              <SkeletonBox width="100%" height={12} style={{ marginBottom: 4 }} />
              <SkeletonBox width="80%" height={12} />
            </View>
            <View className="mt-2">
              <SkeletonBox width={50} height={16} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

