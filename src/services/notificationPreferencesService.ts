import { ApiError, apiClient, toApiError } from './apiClient';

type ServiceResult<T> = { data: T | null; error: ApiError | null };

export type NotificationPreference = {
  id: string;
  user_id: string;
  role: 'consumer' | 'merchant';
  allow_push_notifications: boolean;
  created_at: string;
  updated_at: string;
};

function prefEndpoint(role: 'consumer' | 'merchant'): string {
  return role === 'merchant'
    ? '/api/v1/merchant/notification-preferences'
    : '/api/v1/consumer/notification-preferences';
}

/**
 * Get notification preferences for a user and role
 */
export async function getNotificationPreferences(
  _userId: string,
  role: 'consumer' | 'merchant'
): Promise<ServiceResult<NotificationPreference>> {
  try {
    const data = await apiClient.get<NotificationPreference>(prefEndpoint(role));
    return { data, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 404) {
      return { data: null, error: null };
    }
    return { data: null, error: apiError };
  }
}

/**
 * Update or create notification preferences
 */
export async function updateNotificationPreferences(
  _userId: string,
  role: 'consumer' | 'merchant',
  allowPushNotifications: boolean
): Promise<ServiceResult<NotificationPreference>> {
  try {
    const data = await apiClient.put<NotificationPreference>(
      prefEndpoint(role),
      { allow_push_notifications: allowPushNotifications }
    );
    return { data, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

/**
 * Check if notifications are enabled for a user and role
 * Returns true by default if no preference exists
 */
export async function areNotificationsEnabled(
  userId: string,
  role: 'consumer' | 'merchant'
): Promise<boolean> {
  const { data } = await getNotificationPreferences(userId, role);

  if (!data) {
    return true;
  }

  return data.allow_push_notifications;
}

