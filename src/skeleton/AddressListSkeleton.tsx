import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

type AddressListSkeletonProps = {
  count?: number;
  showTitle?: boolean;
};

function AddressCardSkeleton({ showTitle = false }: { showTitle?: boolean }) {
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
    <View className="px-4 py-4 flex-row items-start justify-between">
      <View className="flex-1 pr-3">
        {showTitle && (
          <View className="flex-row items-center mb-3">
            <Animated.View
              className="w-5 h-5 bg-gray-200 rounded mr-2"
              style={{ opacity }}
            />
            <Animated.View
              className="h-4 bg-gray-200 rounded"
              style={{ width: 60, opacity }}
            />
          </View>
        )}
        <Animated.View
          className="h-5 bg-gray-200 rounded mb-2"
          style={{ width: '85%', opacity }}
        />
        <Animated.View
          className="h-4 bg-gray-200 rounded"
          style={{ width: '60%', opacity }}
        />
      </View>
      <View className="flex-row items-center gap-3">
        <Animated.View
          className="w-10 h-10 bg-gray-100 rounded-lg"
          style={{ opacity }}
        />
        <Animated.View
          className="w-10 h-10 bg-gray-100 rounded-lg"
          style={{ opacity }}
        />
      </View>
    </View>
  );
}

export default function AddressListSkeleton({ count = 3, showTitle = false }: AddressListSkeletonProps) {
  return (
    <View className="px-4 mt-4">
      <View className="bg-white rounded-2xl overflow-hidden">
        {Array.from({ length: count }).map((_, index) => (
          <React.Fragment key={index}>
            <AddressCardSkeleton showTitle={showTitle && index === 0} />
            {index < count - 1 && <View className="h-px bg-gray-200 mx-4" />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
