import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MerchantShop } from '../../../../services/merchant/shopService';
import { getShopReviews, getShopReviewStats, ReviewWithUser } from '../../../../services/consumer/reviewService';
import StarIcon from '../../../../icons/StarIcon';

type ReviewsSectionProps = {
  shop: MerchantShop;
};

export default function ReviewsSection({ shop }: ReviewsSectionProps) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [stats, setStats] = useState<{ average_rating: number; total_reviews: number; rating_distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [reviewsResult, statsResult] = await Promise.all([
        getShopReviews(shop.id),
        getShopReviewStats(shop.id),
      ]);

      if (reviewsResult.error) {
        setError(t('merchant.dashboardSection.reviews.failedToLoad'));
        console.error('Error fetching reviews:', reviewsResult.error);
      } else {
        setReviews(reviewsResult.data || []);
      }

      if (statsResult.error) {
        console.error('Error fetching stats:', statsResult.error);
      } else {
        setStats(statsResult.data || null);
      }
    } catch (err) {
      setError(t('merchant.dashboardSection.reviews.unexpectedError'));
      console.error('Error fetching reviews:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [shop.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchReviews();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return t('merchant.dashboardSection.reviews.todayAt', { time });
    } else if (diffInDays === 1) {
      const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return t('merchant.dashboardSection.reviews.yesterdayAt', { time });
    } else if (diffInDays < 7) {
      return t('merchant.dashboardSection.reviews.daysAgo', { count: diffInDays });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  if (isLoading && !stats) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">{t('merchant.dashboardSection.reviews.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      {/* Average Rating Card */}
      <View className="bg-white rounded-xl p-6 mb-4 border border-gray-200">
        <View className="items-center mb-4">
          {stats && stats.total_reviews > 0 ? (
            <>
              <View className="flex-row items-center mb-2">
                <Text className="text-4xl font-bold text-gray-900 mr-2">
                  {stats.average_rating.toFixed(1)}
                </Text>
                <View className="flex-row items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <View key={star} className="mx-0.5">
                      <StarIcon
                        size={24}
                        color="#FCD34D"
                        filled={star <= Math.round(stats.average_rating)}
                      />
                    </View>
                  ))}
                </View>
              </View>
              <Text className="text-gray-600 text-base">
                {t('merchant.dashboardSection.reviews.basedOn', { count: stats.total_reviews })}
              </Text>
            </>
          ) : (
            <>
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl font-semibold text-gray-500">{t('merchant.dashboardSection.reviews.noReviewsYet')}</Text>
              </View>
              <Text className="text-gray-500 text-sm">{t('merchant.dashboardSection.reviews.startReceivingOrders')}</Text>
            </>
          )}
        </View>

        {/* Rating Distribution */}
        {stats && stats.total_reviews > 0 && (
          <View className="mt-4 pt-4 border-t border-gray-200">
            <Text className="text-sm font-semibold text-gray-700 mb-3">{t('merchant.dashboardSection.reviews.ratingDistribution')}</Text>
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.rating_distribution[rating as keyof typeof stats.rating_distribution];
              const percentage = stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0;
              return (
                <View key={rating} className="flex-row items-center mb-2">
                  <Text className="text-sm text-gray-600 w-8">{rating}</Text>
                  <View className="flex-row items-center mr-2">
                    <StarIcon size={16} color="#FCD34D" filled />
                  </View>
                  <View className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                    <View
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </View>
                  <Text className="text-sm text-gray-600 w-12 text-right">{count}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Reviews List */}
      {error && (
        <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <Text className="text-red-800 text-sm">{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : reviews.length === 0 ? (
        <View className="bg-white rounded-xl p-8 items-center border border-gray-200">
          <Text className="text-6xl mb-4">⭐</Text>
          <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">
            {t('merchant.dashboardSection.reviews.noReviewsYet')}
          </Text>
          <Text className="text-gray-500 text-center">
            {t('merchant.dashboardSection.reviews.reviewsFromCustomers')}
          </Text>
        </View>
      ) : (
        <View>
          <Text className="text-lg font-bold text-gray-900 mb-4">
            {t('merchant.dashboardSection.reviews.allReviews', { count: reviews.length })}
          </Text>
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} formatDate={formatDate} />
          ))}
        </View>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}

function ReviewCard({
  review,
  formatDate,
}: {
  review: ReviewWithUser;
  formatDate: (dateString: string) => string;
}) {
  const { t } = useTranslation();
  // Display name: use name if available, otherwise fallback to email
  // Since reviews are from authenticated users, they should always have email
  const displayName = review.user?.name || review.user?.email || t('merchant.dashboardSection.reviews.user');
  
  // Calculate initials based on name if available, otherwise use email username
  const getInitials = () => {
    if (review.user?.name) {
      return review.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    } else if (review.user?.email) {
      // Use first letter of email username (before @)
      const emailUsername = review.user.email.split('@')[0];
      return emailUsername.slice(0, 2).toUpperCase();
    }
    return 'U';
  };
  
  const initials = getInitials();

  return (
    <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
      {/* Review Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-row items-center flex-1">
          {/* User Avatar */}
          <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
            <Text className="text-blue-600 font-semibold text-sm">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-semibold text-base">{displayName}</Text>
            <Text className="text-gray-500 text-xs mt-0.5">{formatDate(review.created_at)}</Text>
          </View>
        </View>
        {/* Stars */}
        <View className="flex-row items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <View key={star} className="mx-0.5">
              <StarIcon
                size={18}
                color="#FCD34D"
                filled={star <= review.rating}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Review Text */}
      {review.review_text && (
        <View className="mt-2">
          <Text className="text-gray-700 text-sm leading-5">{review.review_text}</Text>
        </View>
      )}

      {/* Updated indicator */}
      {review.updated_at !== review.created_at && (
        <Text className="text-gray-400 text-xs mt-2">{t('merchant.dashboardSection.reviews.updated')}</Text>
      )}
    </View>
  );
}

