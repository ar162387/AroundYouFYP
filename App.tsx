import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from 'react-query';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { CartProvider } from './src/context/CartContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase } from './src/services/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
    },
  },
});

// Component to handle app state changes and refresh connections
function AppStateHandler() {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - refresh connections
        console.log('App came to foreground - refreshing connections');
        
        // Refresh Supabase session
        supabase.auth.getSession().catch((error) => {
          console.error('Error refreshing Supabase session:', error);
        });

        // Refetch all active queries by invalidating all
        queryClient.invalidateQueries([]);
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  // Periodic connection health check
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      try {
        // Test Supabase connection with a lightweight query
        const { error } = await supabase.from('shops').select('id').limit(1);
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
          console.warn('Supabase connection health check failed:', error.message);
          // Try to refresh session
          await supabase.auth.getSession();
        }
      } catch (error) {
        console.error('Connection health check error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(healthCheckInterval);
  }, []);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppStateHandler />
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
            <AppNavigator />
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
