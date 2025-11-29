/**
 * Inventory Search RAG
 * 
 * RAG system for semantic search of merchant items using vector embeddings.
 * Enables searching inventory by natural language queries.
 */

import { supabase, executeWithRetry } from '../supabase';
import { generateEmbedding } from './embeddingService';
import type { PostgrestError } from '@supabase/supabase-js';

export interface SearchItemResult {
  merchant_item_id: string;
  item_name: string;
  item_description: string | null;
  item_image_url: string | null;
  price_cents: number;
  is_active: boolean;
  similarity: number; // 0.0 to 1.0
}

export interface SearchItemResultWithShop extends SearchItemResult {
  shop_id: string;
  shop_name: string;
}

type ServiceResult<T> = { data: T | null; error: PostgrestError | string | null };

/**
 * Search items within a single shop using semantic similarity
 * Falls back to text search if vector search fails or returns no results
 */
export async function searchItemsInShop(
  shopId: string,
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    useTextFallback?: boolean;
  }
): Promise<ServiceResult<SearchItemResult[]>> {
  const limit = options?.limit ?? 10;
  const minSimilarity = options?.minSimilarity ?? 0.6; // Lowered from 0.7 for better recall
  const useTextFallback = options?.useTextFallback ?? true;

  try {
    // Generate embedding for the query
    const { embedding, error: embeddingError } = await generateEmbedding(query);

    if (embeddingError || !embedding) {
      console.warn('[InventorySearchRAG] Embedding generation failed, using text fallback:', embeddingError);
      
      // Fallback to text search if embedding fails
      if (useTextFallback) {
        return await searchItemsInShopTextFallback(shopId, query, limit);
      }
      
      return { data: null, error: embeddingError || 'Failed to generate embedding' };
    }

    // Call the database function for similarity search
    const { data, error } = await executeWithRetry(async (client) => {
      return await client.rpc('search_items_by_similarity', {
        p_shop_id: shopId,
        p_query_embedding: embedding,
        p_limit: limit * 2, // Get more results to filter
        p_min_similarity: 0.5, // Lower threshold initially
      });
    });

    if (error) {
      console.warn('[InventorySearchRAG] Vector search error, using text fallback:', error);
      
      // Fallback to text search if vector search fails
      if (useTextFallback) {
        return await searchItemsInShopTextFallback(shopId, query, limit);
      }
      
      return { data: null, error };
    }

    // Map and filter results
    const vectorItems: SearchItemResult[] = (data || [])
      .filter((item) => parseFloat(item.similarity) >= minSimilarity)
      .map((item) => ({
        merchant_item_id: item.merchant_item_id,
        item_name: item.item_name,
        item_description: item.item_description,
        item_image_url: item.item_image_url,
        price_cents: item.price_cents,
        is_active: item.is_active,
        similarity: parseFloat(item.similarity),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // If vector search returns results, use them
    if (vectorItems.length > 0) {
      console.log(`[InventorySearchRAG] Found ${vectorItems.length} items via vector search`);
      return { data: vectorItems, error: null };
    }

    // If no vector results but fallback enabled, try text search
    if (useTextFallback) {
      console.log('[InventorySearchRAG] No vector results, using text fallback');
      return await searchItemsInShopTextFallback(shopId, query, limit);
    }

    return { data: [], error: null };
  } catch (error: any) {
    console.error('[InventorySearchRAG] Exception searching items:', error);
    
    // Fallback to text search on exception
    if (useTextFallback) {
      console.log('[InventorySearchRAG] Exception caught, using text fallback');
      return await searchItemsInShopTextFallback(shopId, query, limit);
    }
    
    return { data: null, error: error?.message || 'Unknown error occurred' };
  }
}

/**
 * Text-based fallback search for items
 * Uses simple SQL ilike matching like the regular search
 */
async function searchItemsInShopTextFallback(
  shopId: string,
  query: string,
  limit: number
): Promise<ServiceResult<SearchItemResult[]>> {
  try {
    const { supabase } = await import('../supabase');
    
    const { data, error } = await supabase
      .from('merchant_items')
      .select(`
        id,
        name,
        description,
        image_url,
        price_cents,
        is_active,
        item_templates!left(image_url)
      `)
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .ilike('name', `%${query.trim()}%`)
      .limit(limit);

    if (error) {
      console.error('[InventorySearchRAG] Text fallback search error:', error);
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Map to SearchItemResult format with high similarity score for exact matches
    const items: SearchItemResult[] = data.map((item: any) => {
      // Use item image or template image
      const templateData = item.item_templates;
      const templateImageUrl = Array.isArray(templateData) 
        ? templateData[0]?.image_url 
        : templateData?.image_url;
      const finalImageUrl = item.image_url || templateImageUrl || null;

      return {
        merchant_item_id: item.id,
        item_name: item.name,
        item_description: item.description,
        item_image_url: finalImageUrl,
        price_cents: item.price_cents,
        is_active: item.is_active,
        similarity: 0.85, // High similarity for text matches
      };
    });

    console.log(`[InventorySearchRAG] Found ${items.length} items via text fallback`);
    return { data: items, error: null };
  } catch (error: any) {
    console.error('[InventorySearchRAG] Exception in text fallback:', error);
    return { data: null, error: error?.message || 'Text fallback search failed' };
  }
}

/**
 * Search items across multiple shops using semantic similarity
 * Useful for comparing items across different shops
 */
export async function searchItemsAcrossShops(
  shopIds: string[],
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
  }
): Promise<ServiceResult<SearchItemResultWithShop[]>> {
  try {
    if (shopIds.length === 0) {
      return { data: [], error: null };
    }

    // Generate embedding for the query
    const { embedding, error: embeddingError } = await generateEmbedding(query);

    if (embeddingError || !embedding) {
      return { data: null, error: embeddingError || 'Failed to generate embedding' };
    }

    const limit = options?.limit ?? 10;
    const minSimilarity = options?.minSimilarity ?? 0.7;

    // Call the database function for cross-shop similarity search
    const { data, error } = await executeWithRetry(async (client) => {
      return await client.rpc('search_items_across_shops_by_similarity', {
        p_shop_ids: shopIds,
        p_query_embedding: embedding,
        p_limit: limit,
        p_min_similarity: minSimilarity,
      });
    });

    if (error) {
      console.error('[InventorySearchRAG] Error searching items across shops:', error);
      return { data: null, error };
    }

    if (!data) {
      return { data: [], error: null };
    }

    // Map and filter results
    const items: SearchItemResultWithShop[] = (data as any[])
      .filter((item) => item.similarity >= minSimilarity)
      .map((item) => ({
        merchant_item_id: item.merchant_item_id,
        shop_id: item.shop_id,
        shop_name: item.shop_name,
        item_name: item.item_name,
        item_description: item.item_description,
        item_image_url: item.item_image_url,
        price_cents: item.price_cents,
        is_active: item.is_active,
        similarity: parseFloat(item.similarity),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return { data: items, error: null };
  } catch (error: any) {
    console.error('[InventorySearchRAG] Exception searching items across shops:', error);
    return { data: null, error: error?.message || 'Unknown error occurred' };
  }
}

/**
 * Format search results for LLM context
 * Converts search results into a readable format for GPT prompts
 */
export function formatSearchResultsForLLM(
  results: SearchItemResult[] | SearchItemResultWithShop[]
): string {
  if (results.length === 0) {
    return 'No matching items found.';
  }

  const formatted = results.map((item, index) => {
    const pricePKR = (item.price_cents / 100).toFixed(2);
    const similarityPercent = (item.similarity * 100).toFixed(0);
    
    if ('shop_name' in item) {
      return `${index + 1}. ${item.item_name} from ${item.shop_name} - PKR ${pricePKR} (${similarityPercent}% match)`;
    } else {
      return `${index + 1}. ${item.item_name} - PKR ${pricePKR} (${similarityPercent}% match)`;
    }
  });

  return `Found Items:\n${formatted.join('\n')}`;
}

