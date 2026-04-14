import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../icons/GoogleIcon';

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;
type SignUpScreenRouteProp = RouteProp<RootStackParamList, 'SignUp'>;

interface Props {
  navigation: SignUpScreenNavigationProp;
  route: SignUpScreenRouteProp;
}

export default function SignUpScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setGeneralError(null);
  };
  const { signUp, signInWithGoogle, user } = useAuth();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const upperSectionHeight = screenHeight * 0.40; // Reduced from 0.5 to 0.35 to fit all content
  const returnTo = route.params?.returnTo;

  // Navigate back when user successfully signs up
  useEffect(() => {
    if (user && !loading) {
      // If returnTo is specified, navigate to it
      // Otherwise, just go back to the previous screen
      if (returnTo) {
        // Check if returnTo is a tab screen - if so, navigate to Home which contains tabs
        const tabScreens = ['HomeTab', 'SearchTab', 'ProfileTab'];
        if (tabScreens.includes(returnTo)) {
          navigation.navigate('Home' as any);
        } else if (returnTo === 'ViewCart') {
          // For ViewCart, use goBack() to preserve route params (shopId)
          navigation.goBack();
        } else {
          // Type assertion needed because returnTo could be any screen key
          navigation.navigate(returnTo as any);
        }
      } else {
        navigation.goBack();
      }
    }
  }, [user, loading, returnTo, navigation]);

  const handleEmailSignUp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setFieldErrors({});
    setGeneralError(null);
    const { error, fieldErrors: fe } = await signUp(email.trim(), password);
    setLoading(false);

    if (error) {
      if (fe && Object.keys(fe).length > 0) {
        setFieldErrors(fe);
      } else {
        setGeneralError(error);
      }
    }
    // Navigation will happen automatically via useEffect when user is set
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);

    if (error) {
      Alert.alert('Google Sign-Up Failed', error);
    }
    // Navigation will happen automatically via useEffect when user is set
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Upper Section - Gradient Header */}
      <LinearGradient
        colors={["#2563eb", "#1d4ed8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
            <Text className="text-white text-4xl font-bold mb-2">Create Account</Text>
            <Text className="text-white/90 text-base">Sign up to start shopping aroundYou</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Lower Section - White Form with Rounded Top Corners */}
      <View 
        className="bg-white rounded-t-3xl flex-1" 
        style={{ marginTop: -36 }}
      >
        <ScrollView 
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-8 pb-4">
            {generalError ? (
              <View className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <Text className="text-sm text-red-800">{generalError}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View className="mb-3">
              <Text className="text-gray-700 text-sm font-medium mb-2">Email</Text>
              <TextInput
                className={`rounded-xl bg-gray-50 px-4 py-3 text-base text-gray-900 ${
                  fieldErrors.email ? 'border-2 border-red-500' : 'border border-gray-200'
                }`}
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearFieldError('email');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
              {fieldErrors.email ? (
                <Text className="mt-1 text-xs text-red-600">{fieldErrors.email}</Text>
              ) : null}
            </View>

            {/* Password Input */}
            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-medium mb-2">Password</Text>
              <TextInput
                className={`rounded-xl bg-gray-50 px-4 py-3 text-base text-gray-900 ${
                  fieldErrors.password ? 'border-2 border-red-500' : 'border border-gray-200'
                }`}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearFieldError('password');
                }}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!loading}
              />
              {fieldErrors.password ? (
                <Text className="mt-1 text-xs text-red-600">{fieldErrors.password}</Text>
              ) : (
                <Text className="mt-1 text-xs text-gray-500">
                  At least 8 characters, including one letter and one digit
                </Text>
              )}
            </View>

            {fieldErrors.name ? (
              <Text className="mb-2 text-xs text-red-600">{fieldErrors.name}</Text>
            ) : null}

            {/* Sign Up Button */}
            <TouchableOpacity
              className="w-full bg-blue-600 rounded-xl py-3.5 items-center justify-center mb-3"
              onPress={handleEmailSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-base font-bold">Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-4">
              <View className="flex-1 h-px bg-gray-300" />
              <Text className="mx-4 text-gray-500 text-sm">OR</Text>
              <View className="flex-1 h-px bg-gray-300" />
            </View>

            {/* Google Sign-Up Button */}
            <TouchableOpacity
              className="w-full bg-white border border-gray-300 rounded-xl py-3.5 items-center justify-center flex-row mb-4"
              onPress={handleGoogleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              <GoogleIcon size={20} />
              <Text className="text-gray-900 text-base font-semibold ml-3">Continue with Google</Text>
            </TouchableOpacity>

            {/* Sign In Link */}
            <View className="flex-row justify-center items-center">
              <Text className="text-gray-600 text-base">Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login', { returnTo })} disabled={loading}>
                <Text className="text-blue-600 font-semibold text-base">Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
