import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

interface SuggestionsComplaintsModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string | null;
  userName?: string | null;
}

export default function SuggestionsComplaintsModal({
  visible,
  onClose,
  userEmail,
  userName,
}: SuggestionsComplaintsModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit via FormSubmit.co
      const formData = new URLSearchParams();
      formData.append('_subject', 'Suggestion/Complaint - Around You');
      formData.append('_captcha', 'false');
      formData.append('_template', 'box');
      formData.append('email', userEmail || '');
      formData.append('name', userName || '');
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
        onClose();
        // Show success message
        Alert.alert(
          t('profile.success') || 'Success',
          t('profile.feedbackSubmitted') || 'Thank you for your feedback! We will review it soon.'
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={onClose} />
          <View className="bg-white rounded-t-3xl max-h-[80%]">
            {/* Header */}
            <View className={`px-6 py-4 border-b border-gray-200 ${isRTL ? 'items-end' : 'items-start'}`}>
              <Text className="text-xl font-bold text-gray-900">
                {t('profile.suggestionComplaint')}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                {t('profile.suggestionComplaintSubtitle') || 'Share your feedback, suggestions, or complaints with us'}
              </Text>
            </View>

            <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
              <View className="px-6 py-4">
                <Text className={`text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('profile.message') || 'Message'}
                </Text>
                <TextInput
                  className={`border border-gray-300 rounded-xl p-4 text-base min-h-[150px] ${isRTL ? 'text-right' : 'text-left'}`}
                  placeholder={t('profile.messagePlaceholder') || 'Enter your message here...'}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={6}
                  value={message}
                  onChangeText={setMessage}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View className="px-6 py-4 border-t border-gray-200 flex-row gap-3">
              <TouchableOpacity
                onPress={onClose}
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

