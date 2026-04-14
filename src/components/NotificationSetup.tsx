import { useEffect, useRef } from 'react';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import {
  initializeNotifications,
  cleanupNotifications,
  setupNotificationTapHandler,
} from '../services/notificationService';
import {
  startPersistentOrderNotification,
  stopPersistentOrderNotification,
} from '../services/persistentOrderNotificationService';
import { handleNotificationNavigation } from '../utils/notificationDeepLinkHandler';

/**
 * Component to set up notifications with navigation
 * Uses navigationRef so it can be rendered outside NavigationContainer
 */
export function NotificationSetup() {
  const { user } = useAuth();
  const cleanupRef = useRef<(() => void) | null>(null);
  const persistentNotificationCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (currentUserId) {
      console.log('[NotificationSetup] User logged in, initializing notifications for user:', currentUserId);
      initializeNotifications(currentUserId)
        .then(() => {
          console.log('[NotificationSetup] Notifications initialized successfully');
        })
        .catch((error) => {
          console.error('[NotificationSetup] Error initializing notifications:', error);
        });

      // Set up notification tap handler using navigation ref
      const cleanup = setupNotificationTapHandler((data) => {
        console.log('[NotificationSetup] Notification tapped with data:', data);
        // Use navigation ref instead of hook since this might be called outside component tree
        if (navigationRef.current?.isReady()) {
          handleNotificationNavigation(data, navigationRef.current as any);
        } else {
          // If navigation isn't ready yet, wait a bit and try again
          setTimeout(() => {
            if (navigationRef.current?.isReady()) {
              handleNotificationNavigation(data, navigationRef.current as any);
            }
          }, 500);
        }
      });
      cleanupRef.current = cleanup;

      // Start persistent order notification monitoring
      console.log('[NotificationSetup] Starting persistent order notification monitoring');
      persistentNotificationCleanupRef.current = startPersistentOrderNotification();
    } else {
      console.log('[NotificationSetup] No user logged in, skipping notification initialization');
      stopPersistentOrderNotification();
    }

    // Server-side device token detach on account switch is handled in authService
    // (before new JWT is stored). Do not call DELETE here — JWT is already the new user → 401.

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (persistentNotificationCleanupRef.current) {
        persistentNotificationCleanupRef.current();
        persistentNotificationCleanupRef.current = null;
      }
    };
  }, [user?.id]);

  return null;
}

