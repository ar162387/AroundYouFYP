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
  const minSimilarity = options?.minSimilarity ?? 0.35; // Lowered from 0.6 to 0.35 - short queries produce lower similarity scores
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

    // Ensure embedding is a fresh array (not a reference that might be cached)
    const freshEmbedding = Array.from(embedding);
    
    // Call the database function for similarity search with retry logic
    let resultData: any = null;
    let lastError: any = null;
    let attemptCount = 0;
    const maxAttempts = 2;
    
    while (attemptCount < maxAttempts) {
      try {
        const { data, error } = await executeWithRetry(async (client) => {
          // Create a fresh array copy to avoid any potential reference issues
          const embeddingCopy = Array.from(freshEmbedding);
          
          return await client.rpc('search_items_by_similarity', {
            p_shop_id: shopId,
            p_query_embedding: embeddingCopy,
            p_limit: limit * 2, // Get more results to filter
            p_min_similarity: 0.3, // Lower threshold initially (0.3) to catch more potential matches
          });
        }, 1);

        if (error) {
          lastError = error;
          console.warn(`[InventorySearchRAG] Vector search error (attempt ${attemptCount + 1}):`, error);
          
          // If it's a connection error and we haven't exhausted attempts, reset connection and retry
          if (attemptCount < maxAttempts - 1) {
            const { resetSupabaseConnection } = await import('../supabase');
            console.log('[InventorySearchRAG] Resetting connection and retrying...');
            await resetSupabaseConnection();
            attemptCount++;
            continue;
          }
          
          // Fallback to text search if vector search fails
          if (useTextFallback) {
            return await searchItemsInShopTextFallback(shopId, query, limit);
          }
          
          return { data: null, error };
        }

        if (!data) {
          console.warn(`[InventorySearchRAG] No data returned from database function (attempt ${attemptCount + 1})`);
          // Don't return empty on first attempt, try once more with connection reset
          if (attemptCount < maxAttempts - 1) {
            const { resetSupabaseConnection } = await import('../supabase');
            console.log('[InventorySearchRAG] No data returned, resetting connection and retrying...');
            await resetSupabaseConnection();
            attemptCount++;
            continue;
          }
          
          // Fallback to text search if no results
          if (useTextFallback) {
            return await searchItemsInShopTextFallback(shopId, query, limit);
          }
          
          return { data: [], error: null };
        }

        // Success - we got data
        resultData = data;
        break;
      } catch (error: any) {
        lastError = error;
        console.error(`[InventorySearchRAG] Exception during search (attempt ${attemptCount + 1}):`, error);
        
        if (attemptCount < maxAttempts - 1) {
          const { resetSupabaseConnection } = await import('../supabase');
          console.log('[InventorySearchRAG] Resetting connection and retrying after exception...');
          await resetSupabaseConnection();
          attemptCount++;
          continue;
        }
        
        // Fallback to text search on exception
        if (useTextFallback) {
          console.log('[InventorySearchRAG] Exception caught, using text fallback');
          return await searchItemsInShopTextFallback(shopId, query, limit);
        }
        
        return { data: null, error: error?.message || 'Unknown error occurred' };
      }
    }
    
    // If we exhausted attempts without getting data, fallback to text search
    if (!resultData) {
      if (useTextFallback) {
        console.log('[InventorySearchRAG] No vector results after retries, using text fallback');
        return await searchItemsInShopTextFallback(shopId, query, limit);
      }
      return { data: [], error: null };
    }

    const data = resultData;

    // Map and filter results
    const vectorItems: SearchItemResult[] = (data || [])
      .filter((item: any) => parseFloat(item.similarity) >= minSimilarity)
      .map((item: any) => ({
        merchant_item_id: item.merchant_item_id,
        item_name: item.item_name,
        item_description: item.item_description,
        item_image_url: item.item_image_url,
        price_cents: item.price_cents,
        is_active: item.is_active,
        similarity: parseFloat(item.similarity),
      }))
      .sort((a: SearchItemResult, b: SearchItemResult) => b.similarity - a.similarity)
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
    const minSimilarity = options?.minSimilarity ?? 0.35; // Lowered from 0.7 to 0.35 - short queries produce lower similarity scores

    // Validate embedding format
    if (!Array.isArray(embedding)) {
      console.error('[InventorySearchRAG] Invalid embedding format: expected array, got', typeof embedding);
      return { data: null, error: 'Invalid embedding format' };
    }

    if (embedding.length !== 1536) {
      console.error(`[InventorySearchRAG] Invalid embedding dimension: expected 1536, got ${embedding.length}`);
      return { data: null, error: `Invalid embedding dimension: expected 1536, got ${embedding.length}` };
    }

    console.log(`[InventorySearchRAG] Searching across ${shopIds.length} shops with embedding dimension ${embedding.length}, minSimilarity: ${minSimilarity}`);

    // Ensure embedding is a fresh array (not a reference that might be cached)
    const freshEmbedding = Array.from(embedding);
    
    // Validate embedding one more time before sending
    if (!Array.isArray(freshEmbedding) || freshEmbedding.length !== 1536) {
      console.error('[InventorySearchRAG] Embedding validation failed before database call');
      return { data: null, error: 'Invalid embedding format' };
    }

    // Call the database function for cross-shop similarity search
    // Use retry logic with connection reset to handle stale connections
    let lastError: any = null;
    let resultData: any = null;
    let attemptCount = 0;
    const maxAttempts = 2;
    
    console.log(`[InventorySearchRAG] 🔍 DETAILED DEBUG INFO:`);
    console.log(`  - Query: "${query}"`);
    console.log(`  - Shop IDs (${shopIds.length}):`, shopIds.map(id => id.substring(0, 8) + '...'));
    console.log(`  - Embedding dimension: ${freshEmbedding.length}`);
    console.log(`  - First 3 embedding values: [${freshEmbedding.slice(0, 3).join(', ')}]`);
    console.log(`  - Min similarity threshold: ${minSimilarity}`);
    console.log(`  - Limit: ${limit}`);
    
    while (attemptCount < maxAttempts) {
      try {
        console.log(`[InventorySearchRAG] 🚀 Calling RPC search_items_across_shops_by_similarity (attempt ${attemptCount + 1}/${maxAttempts})...`);
        
        const { data, error } = await executeWithRetry(async (client) => {
          // Create a fresh array copy to avoid any potential reference issues
          const embeddingCopy = Array.from(freshEmbedding);
          
          // Log the exact parameters being sent to the RPC
          // Use 0.3 for initial database filter (lower threshold to catch more potential matches)
          // The minSimilarity parameter will filter results further in JavaScript
          const dbMinSimilarity = 0.3;
          const rpcParams = {
            p_shop_ids: shopIds,
            p_query_embedding: embeddingCopy,
            p_limit: limit * 2,
            p_min_similarity: dbMinSimilarity,
          };
          
          console.log(`[InventorySearchRAG] 📤 RPC Parameters:`);
          console.log(`  - p_shop_ids: [${shopIds.length} shops]`);
          console.log(`  - p_query_embedding: [${embeddingCopy.length} dimensions]`);
          console.log(`  - p_limit: ${limit * 2}`);
          console.log(`  - p_min_similarity: ${dbMinSimilarity} (database filter, will refine to ${minSimilarity} in JS)`);
          
          return await client.rpc('search_items_across_shops_by_similarity', rpcParams);
        }, 1); // Only 1 retry from executeWithRetry, we handle our own retries

        if (error) {
          lastError = error;
          console.error(`[InventorySearchRAG] ❌ Error searching items across shops (attempt ${attemptCount + 1}):`, error);
          console.error('[InventorySearchRAG] Error details:', JSON.stringify(error, null, 2));
          console.error('[InventorySearchRAG] Error code:', error.code);
          console.error('[InventorySearchRAG] Error message:', error.message);
          console.error('[InventorySearchRAG] Error hint:', error.hint);
          
          // If it's a connection error and we haven't exhausted attempts, reset connection and retry
          if (attemptCount < maxAttempts - 1) {
            const { resetSupabaseConnection } = await import('../supabase');
            console.log('[InventorySearchRAG] Resetting connection and retrying...');
            await resetSupabaseConnection();
            attemptCount++;
            continue;
          }
          
          return { data: null, error };
        }

        if (!data) {
          console.warn(`[InventorySearchRAG] ⚠️  No data returned from database function (attempt ${attemptCount + 1})`);
          console.warn(`[InventorySearchRAG] This could mean:`);
          console.warn(`  1. No embeddings exist for items in these shops`);
          console.warn(`  2. All similarities are below the threshold (${minSimilarity})`);
          console.warn(`  3. Database function returned NULL`);
          
          // Don't return empty on first attempt, try once more with connection reset
          if (attemptCount < maxAttempts - 1) {
            const { resetSupabaseConnection } = await import('../supabase');
            console.log('[InventorySearchRAG] No data returned, resetting connection and retrying...');
            await resetSupabaseConnection();
            attemptCount++;
            continue;
          }
          
          console.log('[InventorySearchRAG] ⚠️  Exhausted all retry attempts, returning empty result');
          return { data: [], error: null };
        }

        // Success - we got data
        resultData = data;
        console.log(`[InventorySearchRAG] ✅ Database function returned ${Array.isArray(resultData) ? resultData.length : 0} raw results`);
        
        if (Array.isArray(resultData) && resultData.length === 0) {
          console.warn(`[InventorySearchRAG] ⚠️  Function succeeded but returned 0 results. Possible reasons:`);
          console.warn(`  1. No merchant items have embeddings in these shops`);
          console.warn(`  2. All items have embeddings but none match above threshold ${minSimilarity}`);
          console.warn(`  3. All matching items are inactive (is_active = false)`);
          console.warn(`  4. Query embedding doesn't match any item embeddings closely enough`);
        } else if (Array.isArray(resultData) && resultData.length > 0) {
          console.log(`[InventorySearchRAG] 📊 Sample result:`, {
            item_name: resultData[0].item_name,
            similarity: resultData[0].similarity,
            shop_name: resultData[0].shop_name,
          });
        }
        
        break;
      } catch (error: any) {
        lastError = error;
        console.error(`[InventorySearchRAG] Exception during search (attempt ${attemptCount + 1}):`, error);
        
        if (attemptCount < maxAttempts - 1) {
          const { resetSupabaseConnection } = await import('../supabase');
          console.log('[InventorySearchRAG] Resetting connection and retrying after exception...');
          await resetSupabaseConnection();
          attemptCount++;
          continue;
        }
        
        return { data: null, error: error?.message || 'Unknown error occurred' };
      }
    }
    
    // If we exhausted attempts without getting data, return error
    if (!resultData && lastError) {
      return { data: null, error: lastError };
    }
    
    // If we still don't have data after all attempts, return empty
    if (!resultData) {
      return { data: [], error: null };
    }

    // Map and filter results
    const data = resultData;
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

