import { supabase, supabaseAdmin } from './supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export type UserRole = 'consumer' | 'merchant' | 'admin';

export interface User {
  id: string;
  email: string | null;
  name?: string | null;
  role: UserRole;
  created_at: string;
}

export interface AuthError {
  message: string;
}

// Email & Password Sign Up
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || null,
          role: 'consumer', // Default role is consumer
        },
      },
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    if (!data.user) {
      return { user: null, error: { message: 'Failed to create user' } };
    }

    // Auto-confirm user email using Admin API (service_role key)
    // This bypasses email confirmation requirement
    if (supabaseAdmin && !data.user.email_confirmed_at) {
      try {
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          data.user.id,
          {
            email_confirm: true,
          }
        );
        if (confirmError) {
          console.warn('Failed to auto-confirm user:', confirmError);
        }
      } catch (error) {
        console.warn('Error confirming user:', error);
      }
    }

    // Profile is automatically created by trigger function handle_new_user()
    // Wait a moment for the trigger to complete, then fetch the profile
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

    // Fetch the user profile (created by trigger)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile doesn't exist yet (trigger might be delayed), use function to create it
    // This bypasses RLS because the function is SECURITY DEFINER
    if (profileError && profileError.code === 'PGRST116') {
      const { error: createError } = await supabase.rpc('create_user_profile_if_not_exists', {
        user_id: data.user.id,
        user_email: data.user.email || '',
        user_name: name || data.user.user_metadata?.name || null,
        user_role: 'consumer',
      });

      if (createError) {
        console.warn('Fallback profile creation error:', createError);
      }

      // Fetch again after function call
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: newProfile?.name || name || data.user.user_metadata?.name || null,
        role: (newProfile?.role as UserRole) || 'consumer',
        created_at: data.user.created_at,
      };

      return { user, error: null };
    }

    // Use profile data if available
    const user: User = {
      id: data.user.id,
      email: data.user.email,
      name: profile?.name || name || data.user.user_metadata?.name || null,
      role: (profile?.role as UserRole) || 'consumer',
      created_at: data.user.created_at,
    };

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Email & Password Sign In
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    if (!data.user) {
      return { user: null, error: { message: 'Failed to sign in' } };
    }

    // Fetch user profile to get role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile doesn't exist, use function to create it (bypasses RLS)
    if (profileError && profileError.code === 'PGRST116') {
      const { error: createError } = await supabase.rpc('create_user_profile_if_not_exists', {
        user_id: data.user.id,
        user_email: data.user.email || '',
        user_name: data.user.user_metadata?.name || null,
        user_role: 'consumer',
      });

      if (createError) {
        console.warn('Profile creation error:', createError);
      }

      // Fetch again after function call
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: newProfile?.name || data.user.user_metadata?.name || null,
        role: (newProfile?.role as UserRole) || 'consumer',
        created_at: data.user.created_at,
      };

      return { user, error: null };
    }

    const user: User = {
      id: data.user.id,
      email: data.user.email,
      name: profile?.name || data.user.user_metadata?.name || null,
      role: (profile?.role as UserRole) || 'consumer',
      created_at: data.user.created_at,
    };

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'An error occurred' } };
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

    // Sign in to Supabase using the Google ID token
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: userInfo.data.idToken,
    });

    if (sessionError) {
      return { user: null, error: { message: sessionError.message } };
    }

    if (!sessionData.user) {
      return { user: null, error: { message: 'Failed to sign in' } };
    }

    // Auto-confirm user email if not confirmed (for Google signups)
    if (supabaseAdmin && !sessionData.user.email_confirmed_at) {
      try {
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          sessionData.user.id,
          {
            email_confirm: true,
          }
        );
        if (confirmError) {
          console.warn('Failed to auto-confirm user:', confirmError);
        }
      } catch (error) {
        console.warn('Error confirming user:', error);
      }
    }

    // Extract name from Google user info
    const googleName = userInfo.data.user?.name || userInfo.data.user?.givenName || null;

    // Wait a bit for the trigger to create the profile, then fetch it
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

    // Fetch user profile (trigger should have created it)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', sessionData.user.id)
      .single();

    // If profile doesn't exist yet, use function to create it (bypasses RLS)
    if (profileError && profileError.code === 'PGRST116') {
      const { error: createError } = await supabase.rpc('create_user_profile_if_not_exists', {
        user_id: sessionData.user.id,
        user_email: sessionData.user.email || '',
        user_name: googleName || sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
        user_role: 'consumer',
      });

      if (createError) {
        console.warn('Profile creation error:', createError);
      }

      // Fetch again after function call
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', sessionData.user.id)
        .single();

      const user: User = {
        id: sessionData.user.id,
        email: sessionData.user.email,
        name: newProfile?.name || googleName || sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
        role: (newProfile?.role as UserRole) || 'consumer',
        created_at: sessionData.user.created_at,
      };

      return { user, error: null };
    }

    const user: User = {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: profile?.name || googleName || sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
      role: (profile?.role as UserRole) || 'consumer',
      created_at: sessionData.user.created_at,
    };

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
    return { user: null, error: { message: error.message || 'An error occurred during Google sign-in' } };
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

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: { message: error.message } };
    }
    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

// Get Current User
export async function getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data: { user: authUser }, error } = await supabase.auth.getUser();

    if (error || !authUser) {
      return { user: null, error: error ? { message: error.message } : null };
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, try to create it using the function
      const { error: createError } = await supabase.rpc('create_user_profile_if_not_exists', {
        user_id: authUser.id,
        user_email: authUser.email || '',
        user_name: authUser.user_metadata?.name || null,
        user_role: 'consumer',
      });

      // Fetch again after function call (even if it failed, try to get profile)
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const user: User = {
        id: authUser.id,
        email: authUser.email,
        name: newProfile?.name || authUser.user_metadata?.name || null,
        role: (newProfile?.role as UserRole) || 'consumer',
        created_at: authUser.created_at,
      };
      return { user, error: null };
    }

    const user: User = {
      id: authUser.id,
      email: authUser.email,
      name: profile?.name || authUser.user_metadata?.name || null,
      role: (profile?.role as UserRole) || 'consumer',
      created_at: authUser.created_at,
    };

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Update User Role
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

// Delete user profile (consumer account) and all related data
export async function deleteUserProfile(
  userId: string
): Promise<{ error: AuthError | null }> {
  try {
    // Use the PostgreSQL function to delete account and all related data
    // This function handles all cascading deletions properly
    const { error } = await supabase.rpc('delete_user_account');

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

