import { supabase, supabaseAdmin } from './supabase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

// Complete the auth session in the browser
WebBrowser.maybeCompleteAuthSession();

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

// Google Sign In
export async function signInWithGoogle(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const redirectTo = makeRedirectUri({
      scheme: Constants.expoConfig?.scheme || 'around-you',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    // Open the auth URL
    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type === 'success' && result.url) {
        // Parse the callback URL to extract tokens or code
        const url = new URL(result.url);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get('access_token') || url.searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || url.searchParams.get('refresh_token');
        const code = url.searchParams.get('code');

        // If we have tokens directly, use them
        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            return { user: null, error: { message: sessionError.message } };
          }

          if (!sessionData.user) {
            return { user: null, error: { message: 'Failed to sign in' } };
          }

          // Auto-confirm user email if not confirmed (for Google OAuth signups)
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
              user_name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
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
              name: newProfile?.name || sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
              role: (newProfile?.role as UserRole) || 'consumer',
              created_at: sessionData.user.created_at,
            };

            return { user, error: null };
          }

          const user: User = {
            id: sessionData.user.id,
            email: sessionData.user.email,
            name: profile?.name || sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
            role: (profile?.role as UserRole) || 'consumer',
            created_at: sessionData.user.created_at,
          };

          return { user, error: null };
        }

        // If we have a code, exchange it for tokens (Supabase handles this automatically via callback)
        if (code) {
          // Supabase should handle the code exchange automatically
          // Wait for the session to be established
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { user: currentUser, error: userError } = await getCurrentUser();
          if (userError || !currentUser) {
            return { user: null, error: { message: 'Failed to complete sign in' } };
          }
          return { user: currentUser, error: null };
        }
      }

      if (result.type === 'cancel') {
        return { user: null, error: { message: 'Google sign-in was cancelled' } };
      }
    }

    return { user: null, error: { message: 'Google sign-in failed' } };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Sign Out
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
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

