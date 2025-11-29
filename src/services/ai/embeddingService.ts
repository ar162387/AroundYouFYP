/**
 * Embedding Service
 * 
 * Service for generating and managing embeddings using OpenAI's text-embedding-3-small model.
 * Handles caching and batch processing for efficiency.
 */

import { 
  createEmbedding, 
  extractEmbeddingVector,
  type OpenAIServiceResult 
} from './openAIService';
import type { OpenAI } from 'openai';

/**
 * Generate embedding for a single text string
 */
export async function generateEmbedding(
  text: string
): Promise<{ embedding: number[] | null; error: string | null }> {
  if (!text || text.trim().length === 0) {
    return { embedding: null, error: 'Text cannot be empty' };
  }
  
  const result = await createEmbedding(text.trim());
  
  if (result.error) {
    return { embedding: null, error: result.error };
  }
  
  if (!result.data) {
    return { embedding: null, error: 'No embedding data returned' };
  }
  
  const embedding = extractEmbeddingVector(result.data, 0);
  
  if (!embedding) {
    return { embedding: null, error: 'Failed to extract embedding vector' };
  }
  
  return { embedding, error: null };
}

/**
 * Generate embeddings for multiple texts in batch
 * OpenAI API supports up to 2048 inputs per request
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100
): Promise<{ embeddings: (number[] | null)[]; errors: (string | null)[] }> {
  const embeddings: (number[] | null)[] = [];
  const errors: (string | null)[] = [];
  
  // Filter out empty texts and track their indices
  const validTexts: string[] = [];
  const textIndices: number[] = [];
  
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      validTexts.push(text.trim());
      textIndices.push(index);
    } else {
      embeddings[index] = null;
      errors[index] = 'Text cannot be empty';
    }
  });
  
  // Process in batches
  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize);
    
    try {
      const result = await createEmbedding(batch);
      
      if (result.error) {
        // Mark all texts in this batch with the error
        batch.forEach((_, batchIndex) => {
          const originalIndex = textIndices[i + batchIndex];
          embeddings[originalIndex] = null;
          errors[originalIndex] = result.error;
        });
        continue;
      }
      
      if (!result.data) {
        batch.forEach((_, batchIndex) => {
          const originalIndex = textIndices[i + batchIndex];
          embeddings[originalIndex] = null;
          errors[originalIndex] = 'No embedding data returned';
        });
        continue;
      }
      
      // Extract embeddings for each text in the batch
      batch.forEach((_, batchIndex) => {
        const originalIndex = textIndices[i + batchIndex];
        const embedding = extractEmbeddingVector(result.data!, batchIndex);
        
        if (embedding) {
          embeddings[originalIndex] = embedding;
          errors[originalIndex] = null;
        } else {
          embeddings[originalIndex] = null;
          errors[originalIndex] = 'Failed to extract embedding vector';
        }
      });
    } catch (error: any) {
      // Mark all texts in this batch with the error
      batch.forEach((_, batchIndex) => {
        const originalIndex = textIndices[i + batchIndex];
        embeddings[originalIndex] = null;
        errors[originalIndex] = error?.message || 'Unknown error occurred';
      });
    }
  }
  
  return { embeddings, errors };
}

/**
 * Generate search text for a merchant item
 * Combines name, description, and categories for better semantic search
 */
export function generateItemSearchText(item: {
  name: string;
  description?: string | null;
  categories?: string[];
}): string {
  const parts: string[] = [item.name];
  
  if (item.description) {
    parts.push(item.description);
  }
  
  if (item.categories && item.categories.length > 0) {
    parts.push(item.categories.join(', '));
  }
  
  return parts.join('. ');
}

/**
 * Generate search text for a user preference
 * Formats preference in a way that's useful for semantic matching
 */
export function generatePreferenceSearchText(preference: {
  entity_name: string;
  preference_type: string;
  preference_value: string;
  context?: Record<string, any> | null;
}): string {
  const parts: string[] = [
    preference.entity_name,
    preference.preference_type,
    preference.preference_value,
  ];
  
  if (preference.context) {
    const contextStr = JSON.stringify(preference.context);
    parts.push(contextStr);
  }
  
  return parts.join(' ');
}

