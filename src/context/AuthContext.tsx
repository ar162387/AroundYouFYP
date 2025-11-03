import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import * as authService from '../services/authService';
import type { User, UserRole } from '../services/authService';

const DEFAULT_ROLE_KEY = 'default_role';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<{ error: string | null }>;
  setDefaultRole: (role: 'consumer' | 'merchant') => Promise<void>;
  getDefaultRole: () => Promise<'consumer' | 'merchant'>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: any = null;

    try {
      // Check for existing session
      checkSession();

      // Listen for auth state changes
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        try {
          if (session?.user) {
            const { user: currentUser, error } = await authService.getCurrentUser();
            if (!error && currentUser) {
              setUser(currentUser);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          setUser(null);
        } finally {
          setLoading(false);
        }
      });
      subscription = authSubscription;
    } catch (error) {
      console.error('Failed to initialize auth state listener:', error);
      setLoading(false);
    }

    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from auth:', error);
        }
      }
    };
  }, []);

  const checkSession = async () => {
    try {
      const { user: currentUser, error } = await authService.getCurrentUser();
      if (!error && currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const { user: newUser, error } = await authService.signUpWithEmail(email, password, name);
      if (error) {
        return { error: error.message };
      }
      if (newUser) {
        setUser(newUser);
        return { error: null };
      }
      return { error: 'Failed to create account' };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { user: signedInUser, error } = await authService.signInWithEmail(email, password);
      if (error) {
        return { error: error.message };
      }
      if (signedInUser) {
        setUser(signedInUser);
        return { error: null };
      }
      return { error: 'Failed to sign in' };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const { user: signedInUser, error } = await authService.signInWithGoogle();
      if (error) {
        return { error: error.message };
      }
      if (signedInUser) {
        setUser(signedInUser);
        return { error: null };
      }
      return { error: 'Failed to sign in with Google' };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (role: UserRole) => {
    if (!user) {
      return { error: 'No user logged in' };
    }
    try {
      const { error } = await authService.updateUserRole(user.id, role);
      if (error) {
        return { error: error.message };
      }
      // Update local user state
      setUser({ ...user, role });
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    }
  };

  const setDefaultRole = async (role: 'consumer' | 'merchant') => {
    try {
      await AsyncStorage.setItem(DEFAULT_ROLE_KEY, role);
    } catch (error) {
      console.error('Error setting default role:', error);
    }
  };

  const getDefaultRole = async (): Promise<'consumer' | 'merchant'> => {
    try {
      const defaultRole = await AsyncStorage.getItem(DEFAULT_ROLE_KEY);
      return (defaultRole as 'consumer' | 'merchant') || 'consumer';
    } catch (error) {
      console.error('Error getting default role:', error);
      return 'consumer';
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateRole,
    setDefaultRole,
    getDefaultRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

