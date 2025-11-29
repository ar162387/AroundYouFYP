import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

export type NotificationPreference = {
  id: string;
  user_id: string;
  role: 'consumer' | 'merchant';
  allow_push_notifications: boolean;
  created_at: string;
  updated_at: string;
};

const TABLE = 'notification_preferences';

/**
 * Get notification preferences for a user and role
 */
export async function getNotificationPreferences(
  userId: string,
  role: 'consumer' | 'merchant'
): Promise<ServiceResult<NotificationPreference>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('role', role)
      .single();

    if (error) {
      // If no preference exists yet, return null (not an error)
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Update or create notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  role: 'consumer' | 'merchant',
  allowPushNotifications: boolean
): Promise<ServiceResult<NotificationPreference>> {
  try {
    // Use upsert to create or update
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          role,
          allow_push_notifications: allowPushNotifications,
        },
        {
          onConflict: 'user_id,role',
        }
      )
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error as PostgrestError };
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
  
  // Default to enabled if no preference exists
  if (!data) {
    return true;
  }

  return data.allow_push_notifications;
}

