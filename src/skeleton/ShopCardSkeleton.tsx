import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

type ShopCardSkeletonProps = {
  count?: number;
};

function ShopCardSkeletonItem() {
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

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <View className="bg-white rounded-2xl shadow-lg mb-4 overflow-hidden">
      {/* Shop Image Skeleton */}
      <Animated.View
        className="w-full h-48 bg-gray-200"
        style={{ opacity }}
      />

      {/* Shop Info Skeleton */}
      <View className="p-4">
        {/* Name and Rating Row */}
        <View className="flex-row items-center justify-between mb-2">
          <Animated.View
            className="h-6 bg-gray-200 rounded"
            style={{ width: '60%', opacity }}
          />
          <View className="flex-row items-center">
            <Animated.View
              className="w-4 h-4 bg-gray-200 rounded mr-1"
              style={{ opacity }}
            />
            <Animated.View
              className="h-4 bg-gray-200 rounded"
              style={{ width: 50, opacity }}
            />
          </View>
        </View>

        {/* Delivery Fee and Time Row */}
        <View className="flex-row items-center justify-between mb-3">
          <Animated.View
            className="h-4 bg-gray-200 rounded"
            style={{ width: 80, opacity }}
          />
          <Animated.View
            className="h-4 bg-gray-200 rounded"
            style={{ width: 100, opacity }}
          />
        </View>

        {/* Tags Skeleton */}
        <View className="flex-row flex-wrap gap-2">
          <Animated.View
            className="h-6 bg-gray-200 rounded-full"
            style={{ width: 70, opacity }}
          />
          <Animated.View
            className="h-6 bg-gray-200 rounded-full"
            style={{ width: 60, opacity }}
          />
          <Animated.View
            className="h-6 bg-gray-200 rounded-full"
            style={{ width: 90, opacity }}
          />
        </View>
      </View>
    </View>
  );
}

export default function ShopCardSkeleton({ count = 3 }: ShopCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <ShopCardSkeletonItem key={index} />
      ))}
    </>
  );
}

