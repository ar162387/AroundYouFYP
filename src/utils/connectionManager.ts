/**
 * Connection Manager for handling stale HTTP connections
 * 
 * This utility helps detect and recover from stale connections that occur
 * when the app has been inactive for long periods. After inactivity, HTTP
 * connection pools can become stale, causing requests to timeout.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Config from 'react-native-config';

const supabaseUrl = Config.SUPABASE_URL || '';
const supabaseAnonKey = Config.SUPABASE_ANON_KEY || '';
const serviceRoleKey = Config.SUPABASE_SERVICE_ROLE_KEY || null;

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

/**
 * Custom fetch wrapper with timeout support using AbortController
 * This ensures requests don't hang indefinitely on stale connections
 */
function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  })
    .then((response) => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
      }
      throw error;
    });
}

// Global reference to the Supabase client
let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;
let connectionResetCount = 0;

/**
 * Create a fresh Supabase client instance
 * This forces new HTTP connections to be established
 */
function createFreshClient(): SupabaseClient {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-client-info': 'around-you-app',
        },
        // Use custom fetch with timeout
        fetch: fetchWithTimeout as any,
      },
      db: {
        schema: 'public',
      },
    }
  );
}

/**
 * Create a fresh admin client instance
 */
function createFreshAdminClient(): SupabaseClient | null {
  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetchWithTimeout as any,
    },
  });
}

/**
 * Get the current Supabase client, creating it if necessary
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createFreshClient();
  }
  return supabaseClient;
}

/**
 * Get the admin Supabase client, creating it if necessary
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseAdminClient && serviceRoleKey && supabaseUrl) {
    supabaseAdminClient = createFreshAdminClient();
  }
  return supabaseAdminClient;
}

/**
 * Check if an error is a timeout or connection error
 */
export function isTimeoutOrConnectionError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  // Check for timeout indicators
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('network request failed') ||
    errorMessage.includes('networkerror') ||
    errorMessage.includes('failed to fetch') ||
    errorCode === 'timeout' ||
    errorCode === 'network_error' ||
    errorCode === 'fetch_error'
  ) {
    return true;
  }
  
  // Check for connection-related HTTP errors
  if (
    error.status === 0 || // Network error
    error.status === 408 || // Request Timeout
    error.status === 504 || // Gateway Timeout
    error.status === 503 // Service Unavailable
  ) {
    return true;
  }
  
  return false;
}

/**
 * Reset the Supabase client connections
 * This forces new HTTP connections to be established
 * Call this when you detect timeout or connection errors
 */
export async function resetSupabaseConnection(): Promise<SupabaseClient> {
  console.log('[ConnectionManager] Resetting Supabase connection...');
  
  try {
    // Store current session before resetting
    const oldClient = supabaseClient;
    let currentSession = null;
    
    if (oldClient) {
      try {
        // Use a timeout for session retrieval to avoid hanging if connection is dead
        const sessionPromise = oldClient.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Session retrieval timeout')), 5000);
        });
        
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        currentSession = data?.session;
      } catch (err) {
        // If session retrieval fails (timeout or error), that's okay
        // The session is stored in AsyncStorage, so it will be restored automatically
        console.warn('[ConnectionManager] Could not retrieve current session (will restore from storage):', err);
      }
    }
    
    // Create fresh client instance
    supabaseClient = createFreshClient();
    connectionResetCount++;
    
    // Restore session if we had one
    if (currentSession) {
      try {
        await supabaseClient.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
        });
        console.log('[ConnectionManager] Session restored after connection reset');
      } catch (err) {
        console.warn('[ConnectionManager] Could not restore session:', err);
      }
    }
    
    // Also reset admin client if it exists
    if (supabaseAdminClient) {
      supabaseAdminClient = createFreshAdminClient();
    }
    
    console.log(`[ConnectionManager] Connection reset complete (count: ${connectionResetCount})`);
    return supabaseClient;
  } catch (error) {
    console.error('[ConnectionManager] Error resetting connection:', error);
    // Fallback: still create a new client even if session restoration fails
    if (!supabaseClient) {
      supabaseClient = createFreshClient();
    }
    return supabaseClient;
  }
}

/**
 * Execute a Supabase operation with automatic retry on timeout
 * If a timeout or connection error occurs, the connection will be reset and retried once
 */
export async function executeWithRetry<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  maxRetries: number = 1
): Promise<T> {
  let lastError: any = null;
  let client = getSupabaseClient();
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout wrapper to the operation itself
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${REQUEST_TIMEOUT}ms`));
        }, REQUEST_TIMEOUT);
      });
      
      const result = await Promise.race([
        operation(client),
        timeoutPromise,
      ]);
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a timeout or connection error
      if (isTimeoutOrConnectionError(error) && attempt < maxRetries) {
        console.warn(
          `[ConnectionManager] Timeout/connection error detected (attempt ${attempt + 1}/${maxRetries + 1}), resetting connection...`
        );
        
        // Reset connection and retry
        client = await resetSupabaseConnection();
        continue;
      }
      
      // If it's not a timeout error or we've exhausted retries, throw the error
      throw error;
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Health check: test the connection and reset if it's dead
 * Returns true if connection is healthy, false if reset was needed
 */
export async function checkConnectionHealth(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    
    // Try a lightweight query with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, 10000); // 10 second timeout for health check
    });
    
    await Promise.race([
      client.from('shops').select('id').limit(1),
      timeoutPromise,
    ]);
    
    return true; // Connection is healthy
  } catch (error: any) {
    console.warn('[ConnectionManager] Health check failed, resetting connection:', error.message);
    
    // Connection is dead, reset it
    await resetSupabaseConnection();
    return false;
  }
}

/**
 * Get the number of times the connection has been reset
 * Useful for debugging and monitoring
 */
export function getConnectionResetCount(): number {
  return connectionResetCount;
}

