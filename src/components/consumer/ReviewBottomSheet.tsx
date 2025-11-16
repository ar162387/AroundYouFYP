import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StarIcon from '../../icons/StarIcon';
import { createOrUpdateReview, hasReviewedShop } from '../../services/consumer/reviewService';

interface ReviewBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
  orderId?: string;
  onReviewSubmitted?: () => void;
}

export default function ReviewBottomSheet({
  visible,
  onClose,
  shopId,
  shopName,
  orderId,
  onReviewSubmitted,
}: ReviewBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      // Check if user has already reviewed this shop
      hasReviewedShop(shopId).then(({ data, error }) => {
        if (!error && data) {
          // User has reviewed before, but we still allow them to update
          // Keep form empty for new submission
          setRating(0);
          setReviewText('');
        }
      });
    } else {
      // Reset form when closing
      setRating(0);
      setReviewText('');
      setError(null);
    }
  }, [visible, shopId]);

  const handleStarPress = (starRating: number) => {
    setRating(starRating);
    setError(null);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: submitError } = await createOrUpdateReview(
        shopId,
        orderId,
        rating,
        reviewText.trim() || undefined
      );

      if (submitError) {
        setError('Failed to submit review. Please try again.');
        console.error('Error submitting review:', submitError);
      } else {
        // Success - close modal and notify parent
        onClose();
        if (onReviewSubmitted) {
          onReviewSubmitted();
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Error submitting review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = rating;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="bg-white rounded-t-3xl"
            style={{
              maxHeight: '50%',
              paddingBottom: Math.max(insets.bottom, 16),
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 pt-4 pb-2">
              {/* Grabber */}
              <View className="items-center mb-4">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </View>

              {/* Title */}
              <Text className="text-xl font-bold text-gray-900 mb-1">Rate Your Experience</Text>
              <Text className="text-base text-gray-600 mb-6">{shopName}</Text>

              {/* Stars */}
              <View className="flex-row items-center justify-center mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleStarPress(star)}
                    activeOpacity={0.7}
                    style={{ marginHorizontal: 4 }}
                  >
                    <StarIcon
                      size={40}
                      color="#FCD34D"
                      filled={star <= displayRating}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Review Text Input */}
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
                placeholder="Share your experience (optional)"
                placeholderTextColor="#9CA3AF"
                value={reviewText}
                onChangeText={(text) => {
                  setReviewText(text);
                  setError(null);
                }}
                multiline
                numberOfLines={4}
                style={{
                  minHeight: 100,
                  textAlignVertical: 'top',
                  paddingTop: 12,
                }}
                maxLength={500}
              />

              {/* Character count */}
              <Text className="text-xs text-gray-400 text-right mt-1 mb-4">
                {reviewText.length}/500
              </Text>

              {/* Error message */}
              {error && (
                <View className="mb-4">
                  <Text className="text-red-600 text-sm text-center">{error}</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                className={`rounded-xl py-4 items-center justify-center ${
                  rating === 0 || isSubmitting
                    ? 'bg-gray-300'
                    : 'bg-blue-600'
                }`}
                onPress={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-base font-semibold">Send Review</Text>
                )}
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                className="mt-3 py-3 items-center justify-center"
                onPress={onClose}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text className="text-gray-600 text-base font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

