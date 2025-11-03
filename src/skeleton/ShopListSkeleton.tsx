import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

type ShopListSkeletonProps = {
  count?: number;
};

function ShopCardSkeleton() {
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
    <View className="bg-white rounded-2xl shadow-md mb-4 overflow-hidden">
      {/* Image and Name Row */}
      <View className="flex-row">
        <Animated.View
          className="w-24 h-24 bg-gray-200 rounded-l-2xl"
          style={{ opacity }}
        />
        <View className="flex-1 p-4 justify-center">
          <Animated.View
            className="h-5 bg-gray-200 rounded mb-2"
            style={{ width: '70%', opacity }}
          />
          <Animated.View
            className="h-4 bg-gray-200 rounded"
            style={{ width: '40%', opacity }}
          />
        </View>
      </View>

      {/* Stats Section */}
      <View className="px-4 pb-4 pt-2 border-t border-gray-100">
        <View className="flex-row justify-between items-center">
          {/* Orders Today */}
          <View className="flex-row items-center flex-1">
            <Animated.View
              className="w-8 h-8 bg-gray-200 rounded-full"
              style={{ opacity }}
            />
            <View className="ml-2 flex-1">
              <Animated.View
                className="h-3 bg-gray-200 rounded mb-1"
                style={{ width: '60%', opacity }}
              />
              <Animated.View
                className="h-4 bg-gray-200 rounded"
                style={{ width: '40%', opacity }}
              />
            </View>
          </View>

          {/* Cancelled Today */}
          <View className="flex-row items-center flex-1 ml-4">
            <Animated.View
              className="w-8 h-8 bg-gray-200 rounded-full"
              style={{ opacity }}
            />
            <View className="ml-2 flex-1">
              <Animated.View
                className="h-3 bg-gray-200 rounded mb-1"
                style={{ width: '60%', opacity }}
              />
              <Animated.View
                className="h-4 bg-gray-200 rounded"
                style={{ width: '40%', opacity }}
              />
            </View>
          </View>

          {/* Revenue Today */}
          <View className="flex-row items-center flex-1 ml-4">
            <Animated.View
              className="w-8 h-8 bg-gray-200 rounded-full"
              style={{ opacity }}
            />
            <View className="ml-2 flex-1">
              <Animated.View
                className="h-3 bg-gray-200 rounded mb-1"
                style={{ width: '60%', opacity }}
              />
              <Animated.View
                className="h-4 bg-gray-200 rounded"
                style={{ width: '40%', opacity }}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function ShopListSkeleton({ count = 3 }: ShopListSkeletonProps) {
  return (
    <View className="px-4 mt-4">
      {Array.from({ length: count }).map((_, index) => (
        <ShopCardSkeleton key={index} />
      ))}
    </View>
  );
}

