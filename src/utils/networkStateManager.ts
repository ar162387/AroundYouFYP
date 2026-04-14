/**
 * Network State Manager
 * 
 * This utility uses NetInfo to properly detect network state and provides
 * reliable network recovery after the app returns from background.
 * 
 * The key insight: Creating a new Supabase client doesn't clear the native
 * HTTP connection pool. We need to:
 * 1. Wait for the network to actually be available
 * 2. Give the native network stack time to recover after foreground
 * 3. Use NetInfo to detect real connectivity, not just try/fail loops
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { logCrashEvent } from './crashlyticsLogger';

// Network state
let isNetworkAvailable = true;
let isInternetReachable: boolean | null = true;
let lastForegroundTime = 0;
let netInfoSubscription: NetInfoSubscription | null = null;
let appStateSubscription: any = null;

// Listeners for network state changes
type NetworkListener = (isConnected: boolean) => void;
const listeners: Set<NetworkListener> = new Set();

// Foreground recovery delay (ms) - give network stack time to recover
const FOREGROUND_RECOVERY_DELAY = 1500;

// Minimum time between foreground events to trigger recovery
const MIN_BACKGROUND_TIME = 5000;

/**
 * Initialize the network state manager
 * Call this once at app startup
 */
export function initializeNetworkStateManager(): void {
  // Subscribe to network state changes
  netInfoSubscription = NetInfo.addEventListener((state: NetInfoState) => {
    const wasAvailable = isNetworkAvailable && isInternetReachable !== false;
    
    isNetworkAvailable = state.isConnected ?? false;
    isInternetReachable = state.isInternetReachable;
    
    const isNowAvailable = isNetworkAvailable && isInternetReachable !== false;
    
    console.log('[NetworkStateManager] Network state changed:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    });
    logCrashEvent('Network state changed', {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? null,
      type: state.type,
    });
    
    // Notify listeners if network became available
    if (!wasAvailable && isNowAvailable) {
      console.log('[NetworkStateManager] Network became available, notifying listeners');
      logCrashEvent('Network became available');
      notifyListeners(true);
    } else if (wasAvailable && !isNowAvailable) {
      console.log('[NetworkStateManager] Network became unavailable');
      logCrashEvent('Network became unavailable');
      notifyListeners(false);
    }
  });
  
  // Subscribe to app state changes
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  
  // Get initial state
  NetInfo.fetch().then((state) => {
    isNetworkAvailable = state.isConnected ?? false;
    isInternetReachable = state.isInternetReachable;
    console.log('[NetworkStateManager] Initial network state:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
    });
  });
  
  console.log('[NetworkStateManager] Initialized');
}

/**
 * Clean up subscriptions
 */
export function cleanupNetworkStateManager(): void {
  if (netInfoSubscription) {
    netInfoSubscription();
    netInfoSubscription = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  listeners.clear();
}

let previousAppState: AppStateStatus = AppState.currentState;

/**
 * Handle app state changes
 */
function handleAppStateChange(nextAppState: AppStateStatus): void {
  const now = Date.now();
  
  if (
    previousAppState.match(/inactive|background/) &&
    nextAppState === 'active'
  ) {
    const timeInBackground = now - lastForegroundTime;
    console.log('[NetworkStateManager] App came to foreground after', timeInBackground, 'ms');
    
    // Only trigger recovery if we were in background for a meaningful amount of time
    if (timeInBackground > MIN_BACKGROUND_TIME) {
      console.log('[NetworkStateManager] Triggering network recovery after background');
      logCrashEvent('Network recovery triggered', {
        timeInBackgroundMs: timeInBackground,
      });
      triggerNetworkRecovery();
    }
    
    lastForegroundTime = now;
  } else if (nextAppState === 'background') {
    lastForegroundTime = now;
  }
  
  previousAppState = nextAppState;
}

/**
 * Trigger network recovery after returning from background
 * This refreshes the network state and notifies listeners after a delay
 */
async function triggerNetworkRecovery(): Promise<void> {
  // Wait for the native network stack to recover
  await new Promise(resolve => setTimeout(resolve, FOREGROUND_RECOVERY_DELAY));
  
  // Refresh network state
  const state = await NetInfo.refresh();
  isNetworkAvailable = state.isConnected ?? false;
  isInternetReachable = state.isInternetReachable;
  
  console.log('[NetworkStateManager] Network state after recovery:', {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
  });
  logCrashEvent('Network recovery complete', {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable ?? null,
  });
  
  // If network is available, notify listeners to refetch
  if (isNetworkAvailable && isInternetReachable !== false) {
    notifyListeners(true);
  }
}

/**
 * Check if network is currently available
 */
export function isNetworkCurrentlyAvailable(): boolean {
  return isNetworkAvailable && isInternetReachable !== false;
}

/**
 * Wait for network to become available
 * Returns immediately if already available, otherwise waits up to timeout
 */
export async function waitForNetwork(timeoutMs: number = 10000): Promise<boolean> {
  // Check current state first
  const currentState = await NetInfo.fetch();
  if (currentState.isConnected && currentState.isInternetReachable !== false) {
    return true;
  }
  
  // Wait for network with timeout
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    
    const subscription = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        cleanup();
        resolve(true);
      }
    });
    
    function cleanup() {
      clearTimeout(timeout);
      subscription();
    }
  });
}

/**
 * Add a listener for network availability changes
 * Returns a cleanup function
 */
export function addNetworkListener(listener: NetworkListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notify all listeners of network state change
 */
function notifyListeners(isConnected: boolean): void {
  listeners.forEach(listener => {
    try {
      listener(isConnected);
    } catch (error) {
      console.error('[NetworkStateManager] Error in listener:', error);
    }
  });
}

/**
 * Perform a lightweight network connectivity test
 * Uses a simple HEAD request to a reliable endpoint
 */
export async function testNetworkConnectivity(timeoutMs: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Use a reliable, fast endpoint for connectivity test
    // Google's generate_204 endpoint is designed for this purpose
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.status === 204 || response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Force refresh network state
 * Useful after the app comes to foreground
 */
export async function refreshNetworkState(): Promise<boolean> {
  const state = await NetInfo.refresh();
  isNetworkAvailable = state.isConnected ?? false;
  isInternetReachable = state.isInternetReachable;
  return isNetworkAvailable && isInternetReachable !== false;
}
