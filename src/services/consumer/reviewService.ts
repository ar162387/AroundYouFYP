/**
 * Review Service
 * 
 * Handles all review-related operations including creating, updating,
 * and fetching reviews and ratings.
 */

import { supabase } from '../supabase';
import { PostgrestError } from '@supabase/supabase-js';

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

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

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
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: userError || new Error('Not authenticated') as any };
    }

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('shop_id', shopId)
      .single();

    if (existingReview) {
      // Update existing review
      const { data, error } = await supabase
        .from('reviews')
        .update({
          rating,
          review_text: reviewText || null,
          order_id: orderId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReview.id)
        .select()
        .single();

      return { data: data as Review | null, error };
    } else {
      // Create new review
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          shop_id: shopId,
          order_id: orderId || null,
          rating,
          review_text: reviewText || null,
        })
        .select()
        .single();

      return { data: data as Review | null, error };
    }
  } catch (error) {
    return { data: null, error: error as PostgrestError };
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: userError || new Error('Not authenticated') as any };
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('shop_id', shopId)
      .maybeSingle();

    return { data: data as Review | null, error };
  } catch (error) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Get review for a specific order
 */
export async function getReviewByOrder(orderId: string): Promise<ServiceResult<Review | null>> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: userError || new Error('Not authenticated') as any };
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('order_id', orderId)
      .maybeSingle();

    return { data: data as Review | null, error };
  } catch (error) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Check if a user has reviewed a shop
 */
export async function hasReviewedShop(shopId: string): Promise<ServiceResult<boolean>> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: false, error: userError || new Error('Not authenticated') as any };
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('shop_id', shopId)
      .maybeSingle();

    if (error) {
      return { data: false, error };
    }

    return { data: !!data, error: null };
  } catch (error) {
    return { data: false, error: error as PostgrestError };
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
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    if (!reviews || reviews.length === 0) {
      return { data: [], error: null };
    }

    // Get user profiles for all reviews (for name)
    const userIds = [...new Set(reviews.map((r) => r.user_id))];
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', userIds);

    // Map user profiles to reviews, fetching email from auth.users if not in user_profiles
    // Since reviews.user_id references auth.users(id), we can get email directly from auth.users
    const reviewsWithUsers: ReviewWithUser[] = await Promise.all(
      reviews.map(async (review) => {
        const profile = userProfiles?.find((p) => p.id === review.user_id);
        
        // Get email from user_profiles if available, otherwise get from auth.users via function
        let email = profile?.email || null;
        if (!email) {
          // Fallback: get email from auth.users using database function
          const { data: emailFromAuth, error: emailError } = await supabase.rpc(
            'get_review_user_email',
            { user_uuid: review.user_id }
          );
          if (!emailError && emailFromAuth) {
            email = emailFromAuth;
          }
        }
        
        return {
          ...review,
          user: {
            id: review.user_id,
            name: profile?.name || null,
            email: email, // Always get email since user is authenticated
          },
        };
      })
    );

    return { data: reviewsWithUsers, error: null };
  } catch (error) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Get shop review statistics
 */
export async function getShopReviewStats(shopId: string): Promise<ServiceResult<ShopReviewStats>> {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('shop_id', shopId);

    if (error) {
      return { data: null, error };
    }

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
    return { data: null, error: error as PostgrestError };
  }
}

