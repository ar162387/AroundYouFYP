import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
  route: LoginScreenRouteProp;
}

export default function LoginScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle, user } = useAuth();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const upperSectionHeight = screenHeight * 0.5;
  const returnTo = route.params?.returnTo;

  // Navigate back when user successfully logs in
  useEffect(() => {
    if (user && !loading) {
      // If returnTo is specified, navigate to it
      // Otherwise, just go back to the previous screen
      if (returnTo) {
        // Check if returnTo is a tab screen - if so, navigate to Home which contains tabs
        const tabScreens = ['HomeTab', 'SearchTab', 'ProfileTab'];
        if (tabScreens.includes(returnTo)) {
          navigation.navigate('Home' as any);
        } else {
          // Type assertion needed because returnTo could be any screen key
          navigation.navigate(returnTo as any);
        }
      } else {
        navigation.goBack();
      }
    }
  }, [user, loading, returnTo, navigation]);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error);
    }
    // Navigation will happen automatically via useEffect when user is set
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);

    if (error) {
      Alert.alert('Google Sign-In Failed', error);
    }
    // Navigation will happen automatically via useEffect when user is set
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Upper Section - Gradient Header (50% of screen) */}
      <LinearGradient
        colors={["#1e3a8a", "#3b82f6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ 
          height: upperSectionHeight,
          paddingTop: insets.top 
        }}
      >
        <View className="px-6 pt-6 pb-6 relative flex-1 justify-center">
          {/* Close Button */}
          <TouchableOpacity
            onPress={handleClose}
            className="absolute top-6 left-6 z-10 w-10 h-10 items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-white text-2xl font-bold">✕</Text>
          </TouchableOpacity>

          {/* Heading */}
          <View>
            <Text className="text-white text-4xl font-bold mb-2">Welcome Back</Text>
            <Text className="text-white/90 text-base">Sign in to continue shopping aroundYou</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Lower Section - White Form with Rounded Top Corners (50% of screen, scrollable) */}
      <View 
        className="bg-white rounded-t-3xl flex-1" 
        style={{ marginTop: -36 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-12 pb-8">
            {/* Email Input */}
            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-medium mb-2">Email</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-900 text-base"
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View className="mb-6">
              <Text className="text-gray-700 text-sm font-medium mb-2">Password</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-900 text-base"
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              className="w-full bg-blue-600 rounded-xl py-4 items-center justify-center mb-4"
              onPress={handleEmailLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-base font-bold">Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-gray-300" />
              <Text className="mx-4 text-gray-500 text-sm">OR</Text>
              <View className="flex-1 h-px bg-gray-300" />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              className="w-full bg-white border border-gray-300 rounded-xl py-4 items-center justify-center flex-row mb-6"
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text className="text-xl mr-3">🔴</Text>
              <Text className="text-gray-900 text-base font-semibold">Continue with Google</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View className="flex-row justify-center items-center mt-4">
              <Text className="text-gray-600 text-base">Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp', { returnTo })} disabled={loading}>
                <Text className="text-blue-600 font-semibold text-base">Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
