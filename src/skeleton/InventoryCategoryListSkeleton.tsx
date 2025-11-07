import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

type InventoryCategoryListSkeletonProps = {
  count?: number;
};

function CategorySkeletonRow() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  return (
    <View className="bg-white border border-gray-100 rounded-3xl p-4">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-4">
          <Animated.View className="h-5 bg-gray-200 rounded-lg" style={{ opacity, width: '60%' }} />
          <Animated.View className="h-4 bg-gray-200 rounded-lg mt-3" style={{ opacity, width: '80%' }} />
        </View>
        <View className="items-end">
          <Animated.View className="h-3 bg-gray-200 rounded-lg" style={{ opacity, width: 70 }} />
          <Animated.View className="h-5 bg-purple-100 rounded-lg mt-3" style={{ opacity, width: 90 }} />
        </View>
      </View>
    </View>
  );
}

export default function InventoryCategoryListSkeleton({ count = 5 }: InventoryCategoryListSkeletonProps) {
  return (
    <View className="space-y-3 py-4">
      {Array.from({ length: count }).map((_, index) => (
        <CategorySkeletonRow key={index} />
      ))}
    </View>
  );
}


