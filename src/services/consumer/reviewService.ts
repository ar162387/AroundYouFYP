import { ApiError, apiClient, toApiError } from '../apiClient';
import { getCurrentUser } from '../authService';

// ============================================================================
// TYPES
// ============================================================================

export interface Review {
  id: string;
  user_id: string;
  shop_id: string;
  order_id?: string;
  rating: number; // 1-5
  review_text?: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithUser extends Review {
  user: {
    id: string;
    name?: string;
    email?: string;
  };
}

export interface ShopReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

type ServiceResult<T> = { data: T | null; error: ApiError | null };

// ============================================================================
// CREATE/UPDATE REVIEW
// ============================================================================

/**
 * Create or update a review for a shop
 * If a review already exists for this user and shop, it will be updated
 */
export async function createOrUpdateReview(
  shopId: string,
  orderId: string | undefined,
  rating: number,
  reviewText?: string
): Promise<ServiceResult<Review>> {
  try {
    const data = await apiClient.post<Review>('/api/v1/consumer/reviews', {
      shop_id: shopId,
      order_id: orderId || null,
      rating,
      review_text: reviewText || null,
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

// ============================================================================
// GET REVIEW
// ============================================================================

/**
 * Get a user's review for a specific shop
 */
export async function getReview(shopId: string): Promise<ServiceResult<Review | null>> {
  try {
    const { user, error } = await getCurrentUser();
    if (error || !user) {
      return { data: null, error: new ApiError(error?.message || 'Not authenticated', 401) };
    }
    const reviews = await getShopReviews(shopId);
    if (reviews.error) return { data: null, error: reviews.error };
    const ownReview = (reviews.data || []).find((review) => review.user_id === user.id) || null;
    return { data: ownReview, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

/**
 * Get review for a specific order
 */
export async function getReviewByOrder(orderId: string): Promise<ServiceResult<Review | null>> {
  try {
    const { user, error } = await getCurrentUser();
    if (error || !user) {
      return { data: null, error: new ApiError(error?.message || 'Not authenticated', 401) };
    }

    const order = await apiClient.get<{ shop_id: string }>(`/api/v1/consumer/orders/${orderId}`);
    const reviews = await getShopReviews(order.shop_id);
    if (reviews.error) return { data: null, error: reviews.error };
    const ownReview =
      (reviews.data || []).find((review) => review.user_id === user.id && review.order_id === orderId) || null;
    return { data: ownReview, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

/**
 * Check if a user has reviewed a shop
 */
export async function hasReviewedShop(shopId: string): Promise<ServiceResult<boolean>> {
  try {
    const review = await getReview(shopId);
    return { data: Boolean(review.data), error: review.error };
  } catch (error) {
    return { data: false, error: toApiError(error) };
  }
}

// ============================================================================
// GET SHOP REVIEWS
// ============================================================================

/**
 * Get all reviews for a shop
 */
export async function getShopReviews(shopId: string): Promise<ServiceResult<ReviewWithUser[]>> {
  try {
    const data = await apiClient.get<ReviewWithUser[]>(`/api/v1/consumer/shops/${shopId}/reviews`);
    const reviews = (data || []).map((review) => ({
      ...review,
      user: review.user || { id: review.user_id },
    }));
    if (reviews.length === 0) {
      return { data: [], error: null };
    }
    return { data: reviews, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

/**
 * Get shop review statistics
 */
export async function getShopReviewStats(shopId: string): Promise<ServiceResult<ShopReviewStats>> {
  try {
    const reviewsResponse = await getShopReviews(shopId);
    if (reviewsResponse.error) return { data: null, error: reviewsResponse.error };
    const reviews = reviewsResponse.data || [];

    if (!reviews || reviews.length === 0) {
      return {
        data: {
          average_rating: 0,
          total_reviews: 0,
          rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
        error: null,
      };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / total) * 100) / 100;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as keyof typeof distribution]++;
      }
    });

    return {
      data: {
        average_rating: average,
        total_reviews: total,
        rating_distribution: distribution,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

