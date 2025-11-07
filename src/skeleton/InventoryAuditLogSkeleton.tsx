import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

type InventoryAuditLogSkeletonProps = {
  count?: number;
};

function AuditSkeletonRow() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });

  return (
    <View className="bg-white border border-gray-100 rounded-3xl p-4">
      <View className="flex-row justify-between">
        <View className="flex-1 pr-4">
          <Animated.View className="h-5 bg-gray-200 rounded-lg" style={{ opacity, width: '65%' }} />
          <Animated.View className="h-4 bg-gray-200 rounded-lg mt-3" style={{ opacity, width: '55%' }} />
          <Animated.View className="h-3 bg-gray-100 rounded-lg mt-3" style={{ opacity, width: '80%' }} />
          <Animated.View className="h-3 bg-gray-100 rounded-lg mt-2" style={{ opacity, width: '70%' }} />
          <Animated.View className="h-3 bg-gray-100 rounded-lg mt-2" style={{ opacity, width: '60%' }} />
        </View>
        <Animated.View className="w-16 h-4 bg-gray-200 rounded-lg" style={{ opacity, marginTop: 4 }} />
      </View>
    </View>
  );
}

export default function InventoryAuditLogSkeleton({ count = 6 }: InventoryAuditLogSkeletonProps) {
  return (
    <View className="space-y-3 py-4">
      {Array.from({ length: count }).map((_, index) => (
        <AuditSkeletonRow key={index} />
      ))}
    </View>
  );
}


