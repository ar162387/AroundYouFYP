import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import BackIcon from '../icons/BackIcon';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SuggestionsComplaints'>;

export default function SuggestionsComplaintsScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert(
        t('profile.error') || 'Error',
        t('profile.messageRequired') || 'Please enter your message'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit via FormSubmit.co
      const formData = new URLSearchParams();
      formData.append('_subject', 'Suggestion/Complaint - Around You');
      formData.append('_captcha', 'false');
      formData.append('_template', 'box');
      formData.append('email', user?.email || '');
      formData.append('name', user?.name || '');
      formData.append('message', message.trim());

      const response = await fetch('https://formsubmit.co/ar162387@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (response.ok) {
        setMessage('');
        Alert.alert(
          t('profile.success') || 'Success',
          t('profile.feedbackSubmitted') || 'Thank you for your feedback! We will review it soon.',
          [
            {
              text: t('profile.ok') || 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert(
          t('profile.error') || 'Error',
          t('profile.feedbackError') || 'Failed to submit. Please try again or contact us directly at ar162387@gmail.com'
        );
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert(
        t('profile.error') || 'Error',
        t('profile.feedbackError') || 'Failed to submit. Please try again or contact us directly at ar162387@gmail.com'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <View className="flex-1 bg-gray-50">
        {/* Gradient overlay behind notch/status bar */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            zIndex: 30,
          }}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["#2563eb", "#1d4ed8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>

        {/* Header */}
        <SafeAreaView edges={['top']} className="bg-white border-b border-gray-200">
          <View className={`flex-row items-center px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`} style={{ paddingTop: insets.top + 12 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className={`w-10 h-10 rounded-full bg-gray-100 items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`}
              activeOpacity={0.7}
            >
              <BackIcon size={20} color="#374151" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className={`text-gray-900 text-lg font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.suggestionComplaint') || 'Suggestion or Complaint'}
              </Text>
              <Text className={`text-gray-500 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('profile.suggestionComplaintSubtitle') || 'Share your feedback, suggestions, or complaints with us'}
              </Text>
            </View>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
          <View className="mb-4">
            <Text className={`text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.message') || 'Message'}
            </Text>
            <TextInput
              className={`border border-gray-300 rounded-xl p-4 text-base min-h-[200px] ${isRTL ? 'text-right' : 'text-left'}`}
              placeholder={t('profile.messagePlaceholder') || 'Enter your message here...'}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={8}
              value={message}
              onChangeText={setMessage}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>

          <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <Text className={`text-blue-800 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.feedbackNote') || 'Your feedback helps us improve our service. We appreciate your time and will review your message soon.'}
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <SafeAreaView edges={['bottom']} className="bg-white border-t border-gray-200 px-6 py-4">
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
            >
              <Text className="text-gray-900 font-semibold">
                {t('profile.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              className={`flex-1 bg-blue-600 rounded-xl py-3 items-center ${(!message.trim() || isSubmitting) ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">
                  {t('profile.submit') || 'Submit'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

