/**
 * OpenAI Service
 * 
 * Provides a client wrapper for OpenAI API calls with proper error handling,
 * rate limiting, and cost tracking.
 */

import OpenAI from 'openai';
import Config from 'react-native-config';

const OPENAI_API_KEY = Config.OPENAI_API_KEY || '';

if (!OPENAI_API_KEY) {
  console.warn('[OpenAIService] OPENAI_API_KEY not found in environment variables');
}

// Create OpenAI client instance
let openaiClient: OpenAI | null = null;

/**
 * Get or create the OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.');
    }

    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true, // Required for React Native
    });
  }

  return openaiClient;
}

/**
 * Service result type for consistent error handling
 */
export type OpenAIServiceResult<T> = {
  data: T | null;
  error: string | null;
};

/**
 * Generate a chat completion using GPT-4o
 */
export async function createChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'function'; content: string; name?: string }>,
  options?: {
    temperature?: number;
    max_tokens?: number;
    functions?: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>;
    function_call?: 'auto' | 'none' | { name: string };
  }
): Promise<OpenAIServiceResult<OpenAI.Chat.Completions.ChatCompletion>> {
  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2000,
      ...(options?.functions && { functions: options.functions as any }),
      ...(options?.function_call && { function_call: options.function_call as any }),
    });

    return { data: response, error: null };
  } catch (error: any) {
    console.error('[OpenAIService] Error creating chat completion:', error);

    const errorMessage = error?.message || 'Unknown error occurred';

    // Handle rate limiting
    if (error?.status === 429) {
      return {
        data: null,
        error: 'Rate limit exceeded. Please try again in a moment.'
      };
    }

    // Handle API key errors
    if (error?.status === 401) {
      return {
        data: null,
        error: 'Invalid API key. Please check your OPENAI_API_KEY configuration.'
      };
    }

    return {
      data: null,
      error: `OpenAI API error: ${errorMessage}`
    };
  }
}

/**
 * Generate embeddings using text-embedding-3-small model
 */
export async function createEmbedding(
  text: string | string[]
): Promise<OpenAIServiceResult<OpenAI.Embeddings.CreateEmbeddingResponse>> {
  try {
    const client = getOpenAIClient();

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return { data: response, error: null };
  } catch (error: any) {
    console.error('[OpenAIService] Error creating embedding:', error);

    const errorMessage = error?.message || 'Unknown error occurred';

    // Handle rate limiting
    if (error?.status === 429) {
      return {
        data: null,
        error: 'Rate limit exceeded. Please try again in a moment.'
      };
    }

    // Handle API key errors
    if (error?.status === 401) {
      return {
        data: null,
        error: 'Invalid API key. Please check your OPENAI_API_KEY configuration.'
      };
    }

    return {
      data: null,
      error: `OpenAI API error: ${errorMessage}`
    };
  }
}

/**
 * Extract embedding vector from OpenAI response
 */
export function extractEmbeddingVector(
  embeddingResponse: OpenAI.Embeddings.CreateEmbeddingResponse,
  index: number = 0
): number[] | null {
  try {
    const embedding = embeddingResponse.data[index];
    if (!embedding) {
      return null;
    }
    return embedding.embedding;
  } catch (error) {
    console.error('[OpenAIService] Error extracting embedding vector:', error);
    return null;
  }
}

/**
 * Generate a chat completion with streaming support
 */
export async function createChatCompletionStream(
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'function'; content: string; name?: string }>,
  onChunk: (chunk: string) => void,
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
): Promise<OpenAIServiceResult<string>> {
  try {
    const client = getOpenAIClient();

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2000,
      stream: true,
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    return { data: fullResponse, error: null };
  } catch (error: any) {
    console.error('[OpenAIService] Error creating streaming chat completion:', error);

    const errorMessage = error?.message || 'Unknown error occurred';

    // Handle rate limiting
    if (error?.status === 429) {
      return {
        data: null,
        error: 'Rate limit exceeded. Please try again in a moment.'
      };
    }

    // Handle API key errors
    if (error?.status === 401) {
      return {
        data: null,
        error: 'Invalid API key. Please check your OPENAI_API_KEY configuration.'
      };
    }

    return {
      data: null,
      error: `OpenAI API error: ${errorMessage}`
    };
  }
}

/**
 * Estimate token count for a message (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is a simple heuristic, OpenAI's actual tokenization is more complex
  return Math.ceil(text.length / 4);
}

/**
 * Reset the OpenAI client (useful for testing or reconfiguration)
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}

