/**
 * Memory Retrieval Service
 * 
 * Service for retrieving user preferences using vector similarity search.
 * Enables RAG-based preference recall for personalized shopping experiences.
 */

import { supabase, executeWithRetry } from '../supabase';
import { generateEmbedding } from './embeddingService';
import type { PostgrestError } from '@supabase/supabase-js';
import type { UserPreference } from '../consumer/preferenceService';

export interface RetrievedPreference {
  preference_id: string;
  user_preference_id: string;
  preference_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string;
  preference_value: string;
  confidence_score: number;
  similarity: number; // 0.0 to 1.0, higher is more similar
}

type ServiceResult<T> = { data: T | null; error: PostgrestError | string | null };

/**
 * Retrieve relevant preferences for a query using vector similarity search
 */
export async function retrievePreferencesBySimilarity(
  query: string,
  options?: {
    limit?: number;
    minConfidence?: number;
    minSimilarity?: number;
  }
): Promise<ServiceResult<RetrievedPreference[]>> {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Generate embedding for the query
    const { embedding, error: embeddingError } = await generateEmbedding(query);

    if (embeddingError || !embedding) {
      return { data: null, error: embeddingError || 'Failed to generate embedding' };
    }

    // Call the database function for similarity search
    const limit = options?.limit ?? 5;
    const minConfidence = options?.minConfidence ?? 0.5;
    const minSimilarity = options?.minSimilarity ?? 0.7;

    const { data, error } = await executeWithRetry(async (client) => {
      return await client.rpc('search_user_preferences_by_similarity', {
        p_user_id: user.id,
        p_query_embedding: embedding, // pgvector expects array format
        p_limit: limit,
        p_min_confidence: minConfidence,
      });
    });

    if (error) {
      console.error('[MemoryRetrievalService] Error retrieving preferences:', error);
      return { data: null, error };
    }

    if (!data) {
      return { data: [], error: null };
    }

    // Filter by minimum similarity and map to result format
    const preferences: RetrievedPreference[] = (data as any[])
      .filter((p) => p.similarity >= minSimilarity)
      .map((p) => ({
        preference_id: p.preference_id,
        user_preference_id: p.user_preference_id,
        preference_type: p.preference_type,
        entity_type: p.entity_type,
        entity_id: p.entity_id,
        entity_name: p.entity_name,
        preference_value: p.preference_value,
        confidence_score: parseFloat(p.confidence_score),
        similarity: parseFloat(p.similarity),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return { data: preferences, error: null };
  } catch (error: any) {
    console.error('[MemoryRetrievalService] Exception retrieving preferences:', error);
    return { data: null, error: error?.message || 'Unknown error occurred' };
  }
}

/**
 * Retrieve preferences for specific categories (e.g., "snacks", "beverages")
 */
export async function retrievePreferencesForCategory(
  category: string,
  options?: {
    limit?: number;
    minConfidence?: number;
  }
): Promise<ServiceResult<RetrievedPreference[]>> {
  const query = `preference for ${category} items`;
  return retrievePreferencesBySimilarity(query, options);
}

/**
 * Retrieve preferences for specific brands
 */
export async function retrievePreferencesForBrand(
  brand: string,
  options?: {
    limit?: number;
    minConfidence?: number;
  }
): Promise<ServiceResult<RetrievedPreference[]>> {
  const query = `preference for ${brand} brand`;
  return retrievePreferencesBySimilarity(query, options);
}

/**
 * Retrieve preferences for specific item types
 */
export async function retrievePreferencesForItemType(
  itemType: string,
  options?: {
    limit?: number;
    minConfidence?: number;
  }
): Promise<ServiceResult<RetrievedPreference[]>> {
  const query = `preference for ${itemType}`;
  return retrievePreferencesBySimilarity(query, options);
}

/**
 * Get formatted preference context for LLM
 * Converts retrieved preferences into a readable format for GPT prompts
 */
export function formatPreferencesForLLM(
  preferences: RetrievedPreference[]
): string {
  if (preferences.length === 0) {
    return 'No relevant preferences found.';
  }

  const formatted = preferences.map((pref, index) => {
    const value = pref.preference_value === 'prefers' 
      ? 'prefers' 
      : pref.preference_value === 'avoids' 
      ? 'avoids'
      : 'is allergic to';
    
    return `${index + 1}. User ${value} "${pref.entity_name}" (${pref.preference_type}, confidence: ${(pref.confidence_score * 100).toFixed(0)}%)`;
  });

  return `User Preferences:\n${formatted.join('\n')}`;
}

/**
 * Check if user has a preference for a specific entity
 */
export async function hasPreferenceForEntity(
  entityName: string,
  entityType?: string
): Promise<ServiceResult<RetrievedPreference | null>> {
  const query = entityType 
    ? `preference for ${entityType} ${entityName}`
    : `preference for ${entityName}`;
  
  const result = await retrievePreferencesBySimilarity(query, {
    limit: 1,
    minConfidence: 0.5,
    minSimilarity: 0.8, // Higher threshold for exact matches
  });

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error };
  }

  // Check if the retrieved preference matches the entity name
  const preference = result.data[0];
  if (preference.entity_name.toLowerCase().includes(entityName.toLowerCase()) ||
      entityName.toLowerCase().includes(preference.entity_name.toLowerCase())) {
    return { data: preference, error: null };
  }

  return { data: null, error: null };
}

