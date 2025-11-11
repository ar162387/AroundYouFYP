import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ShopScreenSkeleton() {
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
      {/* Hero Banner Skeleton */}
      <SkeletonBox width={SCREEN_WIDTH} height={200} style={{ borderRadius: 0 }} />

      {/* Info Cards Grid Skeleton */}
      <View className="px-4 py-4 bg-white">
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              className="rounded-xl p-3 mb-2"
              style={{ width: '48%', marginHorizontal: '1%' }}
            >
              <SkeletonBox width="100%" height={40} />
            </View>
          ))}
        </View>
      </View>

      {/* Search Bar Skeleton */}
      <View className="px-4 pb-3 bg-white">
        <SkeletonBox width="100%" height={52} style={{ borderRadius: 16 }} />
      </View>

      {/* Category Bar Skeleton */}
      <View className="bg-white border-t border-b border-gray-200 px-4 py-3">
        <View className="flex-row">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBox
              key={i}
              width={80}
              height={36}
              style={{ marginRight: 8, borderRadius: 18 }}
            />
          ))}
        </View>
      </View>

      {/* Category Section Skeleton */}
      <View className="bg-gray-50 pt-2">
        {[1, 2, 3].map((categoryIndex) => (
          <View key={categoryIndex} className="mb-4">
            {/* Category Header */}
            <View className="flex-row items-center justify-between px-4 mb-3 mt-3">
              <SkeletonBox width={120} height={24} />
              <SkeletonBox width={60} height={20} />
            </View>

            {/* Items Horizontal List */}
            <View className="flex-row px-4">
              {[1, 2, 3].map((itemIndex) => (
                <View key={itemIndex} className="mr-3" style={{ width: 155 }}>
                  <SkeletonBox width={140} height={140} style={{ borderRadius: 16 }} />
                  <View className="mt-3">
                    <SkeletonBox width="100%" height={12} style={{ marginBottom: 4 }} />
                    <SkeletonBox width="70%" height={12} />
                  </View>
                  <View className="mt-2">
                    <SkeletonBox width={50} height={16} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

