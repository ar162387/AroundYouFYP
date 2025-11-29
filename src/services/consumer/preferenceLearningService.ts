/**
 * Preference Learning Service
 * 
 * Infers user preferences from order history and stores them.
 * Analyzes patterns in ordered items to learn user preferences.
 */

import { createPreference, upsertPreference } from './preferenceService';
import { generateEmbedding } from '../ai/embeddingService';
import { supabase, executeWithRetry } from '../supabase';
import type { UserPreference } from './preferenceService';
import type { PostgrestError } from '@supabase/supabase-js';

interface OrderItem {
  item_id: string;
  item_name: string;
  quantity: number;
  order_count: number; // How many times this item was ordered
}

type ServiceResult<T> = { data: T | null; error: PostgrestError | string | null };

/**
 * Analyze order history and infer preferences
 * Called when an order is delivered
 */
export async function learnPreferencesFromOrder(
  orderId: string
): Promise<ServiceResult<void>> {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Get order details
    const { data: order, error: orderError } = await executeWithRetry(async (client) => {
      return await client
        .from('orders')
        .select('id, user_id, shop_id, status')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();
    });

    if (orderError || !order) {
      return { data: null, error: orderError || 'Order not found' };
    }

    // Only learn from delivered orders
    if (order.status !== 'delivered') {
      return { data: null, error: null }; // Not an error, just skip
    }

    // Get all delivered orders for this user
    const { data: orders, error: ordersError } = await executeWithRetry(async (client) => {
      return await client
        .from('orders')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'delivered');
    });

    if (ordersError) {
      return { data: null, error: ordersError };
    }

    const orderIds = orders?.map((o) => o.id) || [];

    // Get all order items
    const { data: orderItems, error: itemsError } = await executeWithRetry(async (client) => {
      return await client
        .from('order_items')
        .select('merchant_item_id, item_name, quantity, order_id')
        .in('order_id', orderIds);
    });

    if (itemsError) {
      return { data: null, error: itemsError };
    }

    // Aggregate items by frequency
    const itemFrequency = new Map<string, OrderItem>();

    orderItems?.forEach((item: any) => {
      const existing = itemFrequency.get(item.merchant_item_id);
      if (existing) {
        existing.order_count += 1;
        existing.quantity += item.quantity;
      } else {
        itemFrequency.set(item.merchant_item_id, {
          item_id: item.merchant_item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          order_count: 1,
        });
      }
    });

    // Create preferences for items ordered 3+ times
    const MIN_ORDER_COUNT = 3;
    const preferences: Promise<ServiceResult<UserPreference>>[] = [];

    itemFrequency.forEach((item) => {
      if (item.order_count >= MIN_ORDER_COUNT) {
        // Calculate confidence based on order frequency
        const confidence = Math.min(0.9, 0.5 + (item.order_count - MIN_ORDER_COUNT) * 0.1);

        preferences.push(
          upsertPreference({
            preference_type: 'item',
            entity_type: 'item',
            entity_id: item.item_id,
            entity_name: item.item_name,
            preference_value: 'prefers',
            confidence_score: confidence,
            source: 'inferred_from_order',
          })
        );
      }
    });

    // Wait for all preferences to be created
    const results = await Promise.allSettled(preferences);

    // Log any errors but don't fail the whole operation
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error creating preference ${index}:`, result.reason);
      } else if (result.value.error) {
        console.error(`Error creating preference ${index}:`, result.value.error);
      }
    });

    // Generate embeddings for new preferences
    // This is done asynchronously to not block the main operation
    generatePreferenceEmbeddings(user.id).catch((err) => {
      console.error('Error generating preference embeddings:', err);
    });

    return { data: null, error: null };
  } catch (error: any) {
    console.error('[PreferenceLearningService] Exception learning preferences:', error);
    return { data: null, error: error?.message || 'Unknown error occurred' };
  }
}

/**
 * Generate embeddings for user preferences that don't have embeddings yet
 */
async function generatePreferenceEmbeddings(userId: string): Promise<void> {
  try {
    // Get preferences without embeddings
    const { data: preferences, error } = await executeWithRetry(async (client) => {
      return await client
        .from('user_preferences')
        .select(`
          id,
          entity_name,
          preference_type,
          preference_value,
          context,
          user_preference_embeddings(id)
        `)
        .eq('user_id', userId)
        .is('user_preference_embeddings.id', null);
    });

    if (error || !preferences) {
      console.error('Error fetching preferences without embeddings:', error);
      return;
    }

    // Generate embeddings for each preference
    for (const preference of preferences) {
      const searchText = `${preference.entity_name} ${preference.preference_type} ${preference.preference_value}`;
      
      const { embedding, error: embeddingError } = await generateEmbedding(searchText);

      if (embeddingError || !embedding) {
        console.error(`Error generating embedding for preference ${preference.id}:`, embeddingError);
        continue;
      }

      // Store embedding
      const { error: insertError } = await supabase
        .from('user_preference_embeddings')
        .insert({
          user_id: userId,
          preference_id: preference.id,
          embedding: embedding,
          metadata: {
            entity_name: preference.entity_name,
            preference_type: preference.preference_type,
            preference_value: preference.preference_value,
            context: preference.context,
          },
        });

      if (insertError) {
        console.error(`Error storing embedding for preference ${preference.id}:`, insertError);
      }
    }
  } catch (error: any) {
    console.error('[PreferenceLearningService] Exception generating embeddings:', error);
  }
}

