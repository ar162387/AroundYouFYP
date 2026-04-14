import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authService from '../services/authService';
import type { User, UserRole } from '../services/authService';
import { logCrashEvent, recordCrashError, setCrashUserId } from '../utils/crashlyticsLogger';

const DEFAULT_ROLE_KEY = 'default_role';

/** Email/password auth: `fieldErrors` maps normalized keys (email, password, name) to messages. */
export type AuthCredentialResult = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<AuthCredentialResult>;
  signIn: (email: string, password: string) => Promise<AuthCredentialResult>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Reload user from /auth/me (e.g. after merchant registration issues a new JWT). */
  refreshUser: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<{ error: string | null }>;
  setDefaultRole: (role: 'consumer' | 'merchant') => Promise<void>;
  getDefaultRole: () => Promise<'consumer' | 'merchant'>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      logCrashEvent('Auth init');
      checkSession();
    } catch (error) {
      console.error('Failed to initialize auth state listener:', error);
      recordCrashError(error, 'Auth init failed');
      setLoading(false);
    }
  }, []);

  const checkSession = async () => {
    try {
      logCrashEvent('Auth check session');
      const { user: currentUser, error } = await authService.getCurrentUser();
      if (!error && currentUser) {
        setUser(currentUser);
        setCrashUserId(currentUser.id);
      } else {
        setUser(null);
        setCrashUserId(null);
      }
      logCrashEvent('Auth check session result', {
        hasUser: !!currentUser,
        hasError: !!error,
      });
    } catch (error) {
      recordCrashError(error, 'Auth check session error');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const { user: currentUser, error } = await authService.getCurrentUser();
      if (!error && currentUser) {
        setUser(currentUser);
        setCrashUserId(currentUser.id);
      }
    } catch (error) {
      recordCrashError(error, 'Auth refresh user error');
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const { user: newUser, error } = await authService.signUpWithEmail(email, password, name);
      if (error) {
        return { error: error.message, fieldErrors: error.fieldErrors };
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
        return { error: error.message, fieldErrors: error.fieldErrors };
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
      setCrashUserId(null);
    } catch (error) {
      console.error('Sign out error:', error);
      recordCrashError(error, 'Sign out error');
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
    refreshUser,
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
