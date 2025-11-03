import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useLocationStore } from '../stores/locationStore';
import { useAuth } from '../context/AuthContext';
import * as merchantService from '../services/merchant/merchantService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasCompletedLocationSetup = useLocationStore((state) => state.hasCompletedLocationSetup);
  const { user, getDefaultRole } = useAuth();

  useEffect(() => {
    // Animate the text popping in
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate based on location setup and default role
    const timer = setTimeout(async () => {
      try {
        if (!hasCompletedLocationSetup) {
          navigation.replace('LocationPermission');
          return;
        }

        // Check default role if user is logged in
        if (user && getDefaultRole) {
          const defaultRole = await getDefaultRole();
          
          if (defaultRole === 'merchant') {
            // Check if merchant account exists
            const { merchant } = await merchantService.getMerchantAccount(user.id);
            if (merchant) {
              navigation.replace('MerchantDashboard');
              return;
            }
          }
        }

        // Default to consumer home
        navigation.replace('Home');
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback to home on error
        navigation.replace('Home');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [scaleAnim, fadeAnim, navigation, hasCompletedLocationSetup, user, getDefaultRole]);

  return (
    <LinearGradient
      colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1 items-center justify-center"
    >
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
        className="items-center"
      >
        <Text className="text-white text-7xl font-bold mb-4">
          Around You
        </Text>
        <Text className="text-white text-xl font-light tracking-widest">
          Discover Local Shops
        </Text>
      </Animated.View>

      {/* Decorative circles */}
      <Animated.View
        style={{ opacity: fadeAnim }}
        className="absolute top-20 left-10 w-20 h-20 rounded-full bg-white/10"
      />
      <Animated.View
        style={{ opacity: fadeAnim }}
        className="absolute bottom-32 right-12 w-32 h-32 rounded-full bg-white/10"
      />
      <Animated.View
        style={{ opacity: fadeAnim }}
        className="absolute top-40 right-8 w-16 h-16 rounded-full bg-white/10"
      />
    </LinearGradient>
  );
}

