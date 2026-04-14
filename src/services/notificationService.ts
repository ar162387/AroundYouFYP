import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidChannel, EventType, Event } from '@notifee/react-native';
import { apiClient, toApiError } from './apiClient';
import { refreshPersistentNotification } from './persistentOrderNotificationService';

type ServiceResult<T> = { data: T | null; error: Error | null };

let isInitialized = false;
let initializedUserId: string | null = null;
let tokenRefreshUnsubscribe: (() => void) | null = null;
let messageUnsubscribe: (() => void) | null = null;

/**
 * Request notification permissions
 * On Android 13+, we need to request POST_NOTIFICATIONS permission explicitly
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Android 13+ (API 33+) requires explicit POST_NOTIFICATIONS permission
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'This app needs notification permission to send you order updates',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Android notification permission denied');
          return false;
        }
        console.log('Android notification permission granted');
      }
      
      // Also request Firebase messaging permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Firebase notification permissions granted');
        return true;
      } else {
        console.log('Firebase notification permissions denied');
        return false;
      }
    } else {
      // iOS
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('iOS notification permissions granted');
        return true;
      } else {
        console.log('iOS notification permissions denied');
        return false;
      }
    }
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Create Android notification channels
 */
export async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const channel: AndroidChannel = {
    id: 'order_notifications',
    name: 'Order Notifications',
    importance: AndroidImportance.HIGH,
    description: 'Notifications for order status updates and new orders',
    sound: 'default',
    vibration: true,
    // Ensure notifications appear in notification panel
    visibility: 1, // VISIBILITY_PUBLIC
    badge: true,
    lights: true,
    lightColor: '#FF0000',
  };

  await notifee.createChannel(channel);
  console.log('Notification channel created');
}

/**
 * Get FCM token
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Register device token in database
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android'
): Promise<ServiceResult<null>> {
  try {
    if (!userId) {
      return { data: null, error: new Error('Missing user id') };
    }

    await apiClient.post('/api/v1/auth/device-token', {
      token,
      platform,
    });
    console.log('Device token registered successfully');
    return { data: null, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    console.error('Exception registering device token:', error);
    return { data: null, error: new Error(apiError.message) };
  }
}

/**
 * Unregister device token from database
 */
export async function unregisterDeviceToken(token: string): Promise<ServiceResult<null>> {
  try {
    await apiClient.delete('/api/v1/auth/device-token', { token });
    console.log('Device token unregistered successfully');
    return { data: null, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    // 401: session already replaced (e.g. account switch) — avoid noisy LogBox
    if (apiError.status !== 401) {
      console.error('Exception unregistering device token:', error);
    }
    return { data: null, error: new Error(apiError.message) };
  }
}

/**
 * Unregister all device tokens for a user (call before logout)
 */
export async function unregisterAllDeviceTokensForUser(
  _userId: string
): Promise<ServiceResult<null>> {
  try {
    // Current backend exposes single-token removal endpoint.
    // Remove currently issued token, which is sufficient for mobile logout cleanup.
    const token = await getFCMToken();
    if (token) {
      await unregisterDeviceToken(token);
    }
    console.log('All device tokens unregistered for user');
    return { data: null, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    console.error('Exception unregistering device tokens for user:', error);
    return { data: null, error: new Error(apiError.message) };
  }
}

/**
 * Handle foreground notifications with Notifee
 */
export async function handleForegroundNotification(remoteMessage: any): Promise<void> {
  try {
    const { notification, data } = remoteMessage;

    if (!notification) return;

    // Check if we have notification permissions (Android 13+)
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!hasPermission) {
        console.warn('Notification permission not granted, requesting...');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.error('Cannot display notification: permission denied');
          return;
        }
      }
    }

    // Display notification using Notifee - ensure it appears in notification panel
    // Use a unique ID so each notification appears separately
    const notificationId = `order_${data.orderId || Date.now()}`;
    
    await notifee.displayNotification({
      id: notificationId,
      title: notification.title || 'New Notification',
      body: notification.body || '',
      data,
      android: {
        channelId: 'order_notifications',
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_notification', // White icon with transparent background
        pressAction: {
          id: 'default',
        },
        sound: 'default',
        // Ensure notification appears in notification panel
        showTimestamp: true,
        autoCancel: true,
        ongoing: false,
        // Make sure it's visible and persistent
        visibility: 1, // VISIBILITY_PUBLIC
      },
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
      },
    });

    console.log('Foreground notification displayed:', notification.title);
    
    // If this is an order status notification, refresh persistent notification
    if (data && (data.type === 'order_status' || data.type === 'active_order')) {
      // Trigger persistent notification refresh
      refreshPersistentNotification().catch((err) => {
        console.error('Error refreshing persistent notification:', err);
      });
    }
  } catch (error) {
    console.error('Error handling foreground notification:', error);
  }
}

/**
 * Handle notification tap/open
 */
export function setupNotificationTapHandler(
  onNotificationTap: (data: any) => void
): () => void {
  // Handle notification opened from quit state
  const unsubscribeQuit = messaging().onNotificationOpenedApp((remoteMessage) => {
    if (remoteMessage.data) {
      onNotificationTap(remoteMessage.data);
    }
  });

  // Handle notification opened from quit state (check if app was opened via notification)
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage?.data) {
        onNotificationTap(remoteMessage.data);
      }
    });

  // Handle notification taps from Notifee (foreground and background)
  const unsubscribeNotifee = notifee.onForegroundEvent(async (event: Event) => {
    if (event.type === EventType.PRESS) {
      const notificationData = event.detail.notification?.data;
      if (notificationData) {
        onNotificationTap(notificationData);
      }
    }
  });

  return () => {
    unsubscribeQuit();
    unsubscribeNotifee();
  };
}

/**
 * Initialize notification system
 */
export async function initializeNotifications(userId: string | null): Promise<void> {
  if (isInitialized && initializedUserId === userId) {
    console.log('Notifications already initialized for current user');
    return;
  }

  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return;
    }

    // Create Android channels
    await createNotificationChannels();

    // Register token if user is logged in
    if (userId) {
      const token = await getFCMToken();
      if (token) {
        console.log('[NotificationService] FCM Token obtained:', token.substring(0, 20) + '...');
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const result = await registerDeviceToken(userId, token, platform);
        if (result.error) {
          console.error('[NotificationService] Failed to register device token:', result.error);
        } else {
          console.log('[NotificationService] Device token registered successfully for user:', userId);
        }
      } else {
        console.warn('[NotificationService] No FCM token available');
      }

      // Listen for token refresh
      if (tokenRefreshUnsubscribe) {
        tokenRefreshUnsubscribe();
      }
      tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken) => {
        console.log('FCM token refreshed:', newToken);
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        await registerDeviceToken(userId, newToken, platform);
      });
    }

    if (messageUnsubscribe) {
      messageUnsubscribe();
    }
    // Set up foreground message handler
    messageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground notification received:', remoteMessage);
      await handleForegroundNotification(remoteMessage);
    });

    // Background message handler is set up in index.js (outside component)
    // It will display notifications automatically when app is in background/quit state

    isInitialized = true;
    initializedUserId = userId;
    console.log('Notifications initialized successfully');
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

/**
 * Cleanup notification listeners (call on logout)
 */
export async function cleanupNotifications(token?: string, userId?: string): Promise<void> {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
    tokenRefreshUnsubscribe = null;
  }
  if (messageUnsubscribe) {
    messageUnsubscribe();
    messageUnsubscribe = null;
  }
  if (userId) {
    await unregisterAllDeviceTokensForUser(userId);
  } else if (token) {
    await unregisterDeviceToken(token);
  }
  isInitialized = false;
  initializedUserId = null;
  console.log('Notifications cleaned up');
}

