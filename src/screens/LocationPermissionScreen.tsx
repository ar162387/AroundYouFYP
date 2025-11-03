import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LocationPermission'>;

export default function LocationPermissionScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleUseCurrentLocation = async () => {
    // Navigate to map screen - it will handle permission request
    navigation.navigate('FirstLaunchMap', { useCurrentLocation: true });
  };

  const handleSelectManually = () => {
    // Navigate to map screen centered at Pakistan
    navigation.navigate('FirstLaunchMap', { useCurrentLocation: false });
  };

  return (
    <View className="flex-1">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        className="flex-1"
      >
        <View className="flex-1 items-center justify-center px-8">
          {/* Title */}
          <View className="items-center mb-12">
            <Text className="text-white text-5xl font-bold mb-4 text-center">
              Location Access
            </Text>
            <Text className="text-white/90 text-lg text-center leading-6">
              We need your location to show you shops and services nearby
            </Text>
          </View>

          {/* Decorative elements */}
          <View className="absolute top-20 left-10 w-20 h-20 rounded-full bg-white/10" />
          <View className="absolute bottom-64 right-12 w-32 h-32 rounded-full bg-white/10" />
          <View className="absolute top-40 right-8 w-16 h-16 rounded-full bg-white/10" />
        </View>

        {/* Buttons at bottom */}
        <View className="px-6 pb-8 pt-4 gap-4">
          <TouchableOpacity
            className="bg-white rounded-xl py-4 px-6 items-center shadow-lg"
            onPress={handleUseCurrentLocation}
            activeOpacity={0.8}
          >
            <Text className="text-blue-600 font-bold text-lg">Use Current Location</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white/20 rounded-xl py-4 px-6 items-center border border-white/30"
            onPress={handleSelectManually}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-lg">Select Address Manually</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

