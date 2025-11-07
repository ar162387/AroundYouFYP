import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

type InventoryTemplateCategorySkeletonProps = {
  count?: number;
};

function TemplateCategorySkeletonCard() {
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
          <Animated.View className="h-5 bg-gray-200 rounded-lg" style={{ opacity, width: '70%' }} />
          <Animated.View className="h-4 bg-gray-200 rounded-lg mt-3" style={{ opacity, width: '90%' }} />
        </View>
        <Animated.View className="h-6 w-24 bg-gray-100 rounded-lg" style={{ opacity }} />
      </View>
    </View>
  );
}

export default function InventoryTemplateCategorySkeleton({ count = 6 }: InventoryTemplateCategorySkeletonProps) {
  return (
    <View className="space-y-3 py-4">
      {Array.from({ length: count }).map((_, index) => (
        <TemplateCategorySkeletonCard key={index} />
      ))}
    </View>
  );
}


