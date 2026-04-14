import { cleanupNotifications, getFCMToken } from './notificationService';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { apiClient, toApiError, type FieldErrors } from './apiClient';
import { clearAuthSession, getAccessToken, setAuthSession } from './authTokenStorage';

/** /auth/me may append these when the JWT role is out of sync with the profile (e.g. merchant upgrade). */
type MeApiPayload = User & {
  access_token?: string;
  expires_at?: string;
  phoneNumber?: string | null;
};

export type UserRole = 'consumer' | 'merchant' | 'admin';

export interface User {
  id: string;
  email: string | null;
  name?: string | null;
  phone_number?: string | null;
  role: UserRole;
  created_at: string;
}

export interface AuthError {
  message: string;
  fieldErrors?: FieldErrors;
}

type AuthResponse = {
  access_token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    phone_number?: string | null;
    phoneNumber?: string | null;
    role: UserRole;
    created_at: string;
  };
};

function mapUser(user: AuthResponse['user']): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    phone_number: user.phone_number ?? user.phoneNumber ?? null,
    role: user.role || 'consumer',
    created_at: user.created_at,
  };
}

async function persistAuth(response: AuthResponse): Promise<User> {
  await setAuthSession(response.access_token, response.expires_at);
  return mapUser(response.user);
}

/**
 * Remove this device's FCM row while the *previous* JWT is still in storage.
 * Prevents 401 when switching accounts (NotificationSetup used to unregister after JWT swap).
 */
async function detachDeviceTokenFromPreviousSession(): Promise<void> {
  const prevJwt = await getAccessToken();
  if (!prevJwt) return;
  const fcm = await getFCMToken();
  if (!fcm) return;
  try {
    await apiClient.delete('/api/v1/auth/device-token', { token: fcm }, { requiresAuth: false, token: prevJwt });
  } catch {
    // Row may already be gone; switching without prior session — ignore
  }
}

// Email & Password Sign Up
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const response = await apiClient.post<AuthResponse>(
      '/api/v1/auth/register',
      { email, password, name: name || null },
      { requiresAuth: false }
    );
    await detachDeviceTokenFromPreviousSession();
    const user = await persistAuth(response);
    return { user, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return {
      user: null,
      error: {
        message: apiError.message,
        fieldErrors: Object.keys(apiError.fieldErrors).length ? apiError.fieldErrors : undefined,
      },
    };
  }
}

// Email & Password Sign In
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const response = await apiClient.post<AuthResponse>(
      '/api/v1/auth/login',
      { email, password },
      { requiresAuth: false }
    );
    await detachDeviceTokenFromPreviousSession();
    const user = await persistAuth(response);
    return { user, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return {
      user: null,
      error: {
        message: apiError.message,
        fieldErrors: Object.keys(apiError.fieldErrors).length ? apiError.fieldErrors : undefined,
      },
    };
  }
}

// Google Sign In - Native implementation
export async function signInWithGoogle(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    // Check if Google Play Services are available (Android only)
    // This will be a no-op on iOS
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    } catch (playServicesError: any) {
      // On iOS, hasPlayServices may throw, but that's okay - continue with sign-in
      if (playServicesError.code !== 'PLAY_SERVICES_NOT_AVAILABLE') {
        console.warn('Google Play Services check warning:', playServicesError);
      }
    }

    // Sign in with Google
    const userInfo = await GoogleSignin.signIn();

    if (!userInfo.data?.idToken) {
      return { user: null, error: { message: 'Failed to get Google ID token' } };
    }

    const response = await apiClient.post<AuthResponse>(
      '/api/v1/auth/google',
      { idToken: userInfo.data.idToken },
      { requiresAuth: false }
    );
    await detachDeviceTokenFromPreviousSession();
    const user = await persistAuth(response);
    return { user, error: null };
  } catch (error: any) {
    // Handle specific Google Sign-In errors
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { user: null, error: { message: 'Google sign-in was cancelled' } };
    } else if (error.code === statusCodes.IN_PROGRESS) {
      return { user: null, error: { message: 'Google sign-in is already in progress' } };
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { user: null, error: { message: 'Google Play Services not available' } };
    } else if (error.code === 'DEVELOPER_ERROR' || error.message?.includes('DEVELOPER_ERROR')) {
      return { 
        user: null, 
        error: { 
          message: 'DEVELOPER_ERROR: Please add SHA-1 fingerprint to Google Cloud Console.\n\nYour SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25\n\nSee docs/FIX_DEVELOPER_ERROR.md for instructions.' 
        } 
      };
    }
    const apiError = toApiError(error);
    return { user: null, error: { message: apiError.message || 'An error occurred during Google sign-in' } };
  }
}

// Sign Out
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    // Sign out from Google (try to sign out, ignore errors if not signed in)
    try {
      await GoogleSignin.signOut();
    } catch (googleError: any) {
      // Ignore Google sign-out errors (user might not be signed in with Google)
      // This is non-critical - we'll still sign out from Supabase
      if (googleError?.code !== 'SIGN_IN_REQUIRED') {
        // Only log if it's not the expected "not signed in" error
        console.warn('Google sign-out error (non-critical):', googleError);
      }
    }

    const { user } = await getCurrentUser();
    const token = await getFCMToken();
    if (token) {
      try {
        await apiClient.delete('/api/v1/auth/device-token', { token });
      } catch {
        // Ignore cleanup failures on sign out.
      }
    }

    await cleanupNotifications(token ?? undefined, user?.id);
    await clearAuthSession();
    return { error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { error: { message: apiError.message } };
  }
}

// Get Current User
export async function getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const payload = await apiClient.get<MeApiPayload>('/api/v1/auth/me');
    if (payload.access_token && payload.expires_at) {
      await setAuthSession(payload.access_token, payload.expires_at);
    }
    const user: User = {
      id: payload.id,
      email: payload.email,
      name: payload.name ?? null,
      phone_number: payload.phone_number ?? payload.phoneNumber ?? null,
      role: payload.role || 'consumer',
      created_at: payload.created_at,
    };
    return { user, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 401) {
      await clearAuthSession();
      return { user: null, error: null };
    }
    return { user: null, error: { message: apiError.message } };
  }
}

export async function updateConsumerProfile(
  name: string,
  phoneNumber: string
): Promise<{ error: AuthError | null }> {
  try {
    await apiClient.put('/api/v1/auth/me', {
      name,
      phoneNumber,
    });
    return { error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return {
      error: {
        message: apiError.message,
        fieldErrors: Object.keys(apiError.fieldErrors).length ? apiError.fieldErrors : undefined,
      },
    };
  }
}

// Update User Role
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ error: AuthError | null }> {
  try {
    if (role === 'consumer') {
      await apiClient.put('/api/v1/auth/me', { name: null });
      return { error: null };
    }
    return {
      error: {
        message:
          'Role updates are no longer handled by auth profile updates. Create a merchant account to switch role.',
      },
    };
  } catch (error) {
    const apiError = toApiError(error);
    return { error: { message: apiError.message } };
  }
}

// Delete user profile (consumer account) and all related data
export async function deleteUserProfile(
  userId: string
): Promise<{ error: AuthError | null }> {
  try {
    await apiClient.delete('/api/v1/auth/me');
    await clearAuthSession();
    return { error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { error: { message: apiError.message } };
  }
}
