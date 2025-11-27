import React, { useEffect, useRef } from 'react';
import './src/i18n/i18n';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from 'react-query';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { CartProvider } from './src/context/CartContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase, checkConnectionHealth, resetSupabaseConnection, isTimeoutOrConnectionError } from './src/services/supabase';

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

        // Check connection health and reset if needed
        checkConnectionHealth()
          .then((isHealthy) => {
            if (!isHealthy) {
              console.log('Connection was stale and has been reset after app foreground');
            }

            // Refresh Supabase session
            return supabase.auth.getSession();
          })
          .catch((error) => {
            console.error('Error refreshing connections:', error);
            // If session refresh fails with timeout, try to reset connection
            if (isTimeoutOrConnectionError(error)) {
              console.log('Timeout detected during session refresh, resetting connection...');
              return resetSupabaseConnection();
            }
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

  // Periodic connection health check with automatic recovery
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      try {
        // Use the connection manager's health check which automatically resets dead connections
        const isHealthy = await checkConnectionHealth();
        if (!isHealthy) {
          console.log('Connection health check detected stale connection and reset it');
        }
      } catch (error) {
        console.error('Connection health check error:', error);
        // If health check itself fails, try to reset the connection
        try {
          await resetSupabaseConnection();
        } catch (resetError) {
          console.error('Failed to reset connection:', resetError);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(healthCheckInterval);
  }, []);

  return null;
}

export default function App() {
  // Initialize Google Sign-In
  useEffect(() => {
    const configureGoogleSignIn = async () => {
      try {
        // Get client IDs from environment variables
        const webClientId = Config.GOOGLE_WEB_CLIENT_ID;
        const iosClientId = Config.GOOGLE_IOS_CLIENT_ID;

        // Log the Client ID being used (for debugging)
        console.log('=== Google Sign-In Configuration ===');
        console.log('Web Client ID:', webClientId || 'NOT SET');
        console.log('iOS Client ID:', iosClientId || 'NOT SET');

        if (!webClientId) {
          console.error('❌ GOOGLE_WEB_CLIENT_ID is not set in environment variables');
          console.error('⚠️ Please check your .env file and rebuild the app');
          return;
        }

        GoogleSignin.configure({
          webClientId: webClientId, // Required for Android
          iosClientId: iosClientId || undefined, // Optional for iOS, falls back to webClientId if not provided
          offlineAccess: true, // If you want to access Google API on behalf of the user FROM YOUR SERVER
          forceCodeForRefreshToken: true, // [Android] related to `serverAuthCode`, read the docs link below *.
        });

        console.log('✅ Google Sign-In configured successfully');
      } catch (error) {
        console.error('❌ Error configuring Google Sign-In:', error);
      }
    };

    configureGoogleSignIn();
  }, []);

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
