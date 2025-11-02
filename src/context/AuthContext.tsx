import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import * as authService from '../services/authService';
import type { User, UserRole } from '../services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateRole,
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

