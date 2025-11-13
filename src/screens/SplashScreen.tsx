import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useLocationStore } from '../stores/locationStore';
import { useAuth } from '../context/AuthContext';
import * as merchantService from '../services/merchant/merchantService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../SplashScreen.jpeg')}
          style={styles.splashImage}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a', // Fallback blue background
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

