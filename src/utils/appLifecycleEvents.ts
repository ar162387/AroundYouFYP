/**
 * App Lifecycle Events
 * 
 * Simple pub/sub mechanism for app lifecycle events.
 * This allows hooks and components to react to:
 * - App returning from background
 * - Network being restored
 * 
 * This is the key fix for the "shops don't load after background" issue.
 * The problem was that useShopsByLocation doesn't use React Query,
 * so invalidateQueries() didn't trigger a refetch.
 */

type EventListener = () => void;

// Event listeners
const foregroundResumeListeners: Set<EventListener> = new Set();
const networkRestoredListeners: Set<EventListener> = new Set();

/**
 * Subscribe to foreground resume events
 * Returns an unsubscribe function
 */
export function onForegroundResume(listener: EventListener): () => void {
  foregroundResumeListeners.add(listener);
  return () => {
    foregroundResumeListeners.delete(listener);
  };
}

/**
 * Subscribe to network restored events
 * Returns an unsubscribe function
 */
export function onNetworkRestored(listener: EventListener): () => void {
  networkRestoredListeners.add(listener);
  return () => {
    networkRestoredListeners.delete(listener);
  };
}

/**
 * Notify all listeners that app resumed from background
 * Called by App.tsx when app comes to foreground after meaningful background time
 */
export function notifyForegroundResume(): void {
  console.log('[AppLifecycleEvents] Notifying foreground resume to', foregroundResumeListeners.size, 'listeners');
  foregroundResumeListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('[AppLifecycleEvents] Error in foreground resume listener:', error);
    }
  });
}

/**
 * Notify all listeners that network was restored
 * Called by App.tsx when NetInfo detects network becoming available
 */
export function notifyNetworkRestored(): void {
  console.log('[AppLifecycleEvents] Notifying network restored to', networkRestoredListeners.size, 'listeners');
  networkRestoredListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('[AppLifecycleEvents] Error in network restored listener:', error);
    }
  });
}
