import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

type InventoryTemplateItemSkeletonProps = {
  count?: number;
};

function TemplateItemSkeletonCard() {
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
    outputRange: [0.4, 0.88],
  });

  return (
    <View className="bg-white border border-gray-100 rounded-3xl p-4 flex-row space-x-4">
      <Animated.View className="w-24 h-24 bg-gray-200 rounded-2xl" style={{ opacity }} />
      <View className="flex-1 justify-between py-1">
        <Animated.View className="h-5 bg-gray-200 rounded-lg" style={{ opacity, width: '75%' }} />
        <Animated.View className="h-4 bg-gray-200 rounded-lg mt-3" style={{ opacity, width: '60%' }} />
        <Animated.View className="h-3 bg-gray-100 rounded-lg mt-3" style={{ opacity, width: '90%' }} />
      </View>
      <Animated.View className="self-start h-6 w-20 bg-gray-100 rounded-lg" style={{ opacity }} />
    </View>
  );
}

export default function InventoryTemplateItemSkeleton({ count = 6 }: InventoryTemplateItemSkeletonProps) {
  return (
    <View className="space-y-3 py-4">
      {Array.from({ length: count }).map((_, index) => (
        <TemplateItemSkeletonCard key={index} />
      ))}
    </View>
  );
}


