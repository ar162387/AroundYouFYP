import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import type { RootStackParamList } from '../navigation/types';
import { navigateAfterConsumerAuth } from '../navigation/consumerAuthReturn';
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
  const [fullName, setFullName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [signupStep, setSignupStep] = useState<'credentials' | 'profile'>('credentials');
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
  const { signUp, completeConsumerProfile, signInWithGoogle } = useAuth();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const upperSectionHeight = screenHeight * 0.40; // Reduced from 0.5 to 0.35 to fit all content
  const returnTo = route.params?.returnTo;
  const shopId = route.params?.shopId;

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
      return;
    }

    setSignupStep('profile');
  };

  const handleCompleteProfile = async () => {
    const cleanedName = fullName.trim();
    const cleanedDigits = phoneDigits.replace(/\D/g, '');
    const nextErrors: Record<string, string> = {};

    if (!cleanedName) {
      nextErrors.name = 'Please enter your full name';
    }

    if (cleanedDigits.length !== 10) {
      nextErrors.phone_number = 'Enter exactly 10 digits after +92';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setLoading(true);
    setFieldErrors({});
    setGeneralError(null);
    const fullPhoneNumber = `+92${cleanedDigits}`;
    const { error, fieldErrors: fe } = await completeConsumerProfile(cleanedName, fullPhoneNumber);
    setLoading(false);

    if (error) {
      if (fe && Object.keys(fe).length > 0) {
        setFieldErrors(fe);
      } else {
        setGeneralError(error);
      }
      return;
    }

    if (returnTo) {
      navigateAfterConsumerAuth(navigation, { returnTo, shopId });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' as never }],
      });
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);

    if (error) {
      Alert.alert('Google Sign-Up Failed', error);
      return;
    }
    setSignupStep('profile');
    setFieldErrors({});
    setGeneralError(null);
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

            {signupStep === 'credentials' ? (
              <>
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
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Login', { returnTo, shopId })}
                    disabled={loading}
                  >
                    <Text className="text-blue-600 font-semibold text-base">Sign In</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text className="text-base text-gray-600 mb-4">
                  One last step: add your name and phone number.
                </Text>

                <View className="mb-3">
                  <Text className="text-gray-700 text-sm font-medium mb-2">Full Name</Text>
                  <TextInput
                    className={`rounded-xl bg-gray-50 px-4 py-3 text-base text-gray-900 ${
                      fieldErrors.name ? 'border-2 border-red-500' : 'border border-gray-200'
                    }`}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9ca3af"
                    value={fullName}
                    onChangeText={(t) => {
                      setFullName(t);
                      clearFieldError('name');
                    }}
                    autoCapitalize="words"
                    autoComplete="name"
                    editable={!loading}
                  />
                  {fieldErrors.name ? (
                    <Text className="mt-1 text-xs text-red-600">{fieldErrors.name}</Text>
                  ) : null}
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-medium mb-2">Phone Number</Text>
                  <View
                    className={`flex-row items-center rounded-xl bg-gray-50 px-4 py-3 ${
                      fieldErrors.phone_number ? 'border-2 border-red-500' : 'border border-gray-200'
                    }`}
                  >
                    <Text className="text-base text-gray-900 mr-2">+92</Text>
                    <TextInput
                      className="flex-1 text-base text-gray-900"
                      placeholder="3001234567"
                      placeholderTextColor="#9ca3af"
                      value={phoneDigits}
                      onChangeText={(t) => {
                        const cleaned = t.replace(/\D/g, '').slice(0, 10);
                        setPhoneDigits(cleaned);
                        clearFieldError('phone_number');
                      }}
                      keyboardType="number-pad"
                      editable={!loading}
                      maxLength={10}
                    />
                  </View>
                  {fieldErrors.phone_number ? (
                    <Text className="mt-1 text-xs text-red-600">{fieldErrors.phone_number}</Text>
                  ) : (
                    <Text className="mt-1 text-xs text-gray-500">Enter 10 digits after +92</Text>
                  )}
                </View>

                <TouchableOpacity
                  className="w-full bg-blue-600 rounded-xl py-3.5 items-center justify-center"
                  onPress={handleCompleteProfile}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white text-base font-bold">Continue</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
