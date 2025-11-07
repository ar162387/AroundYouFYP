import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

type InventoryItemListSkeletonProps = {
  count?: number;
};

function ItemSkeletonCard() {
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
    outputRange: [0.4, 0.85],
  });

  return (
    <View className="bg-white border border-gray-100 rounded-3xl p-4">
      <View className="flex-row space-x-4">
        <Animated.View className="w-24 h-24 bg-gray-200 rounded-2xl" style={{ opacity }} />
        <View className="flex-1 justify-between">
          <View>
            <Animated.View className="h-5 bg-gray-200 rounded-lg" style={{ opacity, width: '70%' }} />
            <Animated.View className="h-4 bg-gray-200 rounded-lg mt-3" style={{ opacity, width: '50%' }} />
          </View>
          <View className="flex-row space-x-2 mt-4">
            {[1, 2, 3].map((token) => (
              <Animated.View
                key={token}
                className="flex-1 h-4 bg-gray-100 rounded-full"
                style={{ opacity, width: '100%' }}
              />
            ))}
          </View>
        </View>
      </View>
      <View className="flex-row justify-between mt-5">
        <Animated.View className="h-8 bg-gray-100 rounded-xl flex-1 mr-3" style={{ opacity }} />
        <Animated.View className="h-8 bg-gray-100 rounded-xl flex-1" style={{ opacity }} />
      </View>
    </View>
  );
}

export default function InventoryItemListSkeleton({ count = 6 }: InventoryItemListSkeletonProps) {
  return (
    <View className="space-y-3 py-4">
      {Array.from({ length: count }).map((_, index) => (
        <ItemSkeletonCard key={index} />
      ))}
    </View>
  );
}


