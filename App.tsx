import React, { useEffect, useRef } from 'react';
import './src/i18n/i18n';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from 'react-query';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { CartProvider } from './src/context/CartContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppAlertProvider } from './src/components/AppAlertProvider';
import AppNavigator from './src/navigation/AppNavigator';
import { NotificationSetup } from './src/components/NotificationSetup';
import { 
  initializeNetworkStateManager, 
  cleanupNetworkStateManager,
  addNetworkListener,
  refreshNetworkState,
} from './src/utils/networkStateManager';
import { notifyForegroundResume, notifyNetworkRestored } from './src/utils/appLifecycleEvents';
import { logCrashEvent } from './src/utils/crashlyticsLogger';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
    },
  },
});

// Delay before refreshing after foreground (let network stack recover)
const FOREGROUND_REFRESH_DELAY = 2000;

// Minimum time in background to trigger refresh
const MIN_BACKGROUND_TIME_FOR_REFRESH = 5000;

// Component to handle app state changes and refresh connections
function AppStateHandler() {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastBackgroundTime = useRef<number>(Date.now());
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      logCrashEvent('AppState change', {
        currentState: appState.current,
        nextState: nextAppState,
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:45',message:'AppState changed',data:{currentState:appState.current,nextState:nextAppState,isForeground:appState.current.match(/inactive|background/)&&nextAppState==='active'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B,C'})}).catch(()=>{});
      // #endregion
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastBackgroundTime.current = Date.now();
        logCrashEvent('App backgrounded', {
          state: nextAppState,
        });
      }
      
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        const timeInBackground = Date.now() - lastBackgroundTime.current;
        console.log('[App] App came to foreground after', timeInBackground, 'ms');
        logCrashEvent('App foregrounded', {
          timeInBackgroundMs: timeInBackground,
          willRefresh: timeInBackground > MIN_BACKGROUND_TIME_FOR_REFRESH,
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:58',message:'App came to foreground',data:{timeInBackground,willRefresh:timeInBackground>MIN_BACKGROUND_TIME_FOR_REFRESH},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B,C'})}).catch(()=>{});
        // #endregion

        // Only refresh if we were in background for a meaningful amount of time
        if (timeInBackground > MIN_BACKGROUND_TIME_FOR_REFRESH) {
          console.log('[App] Triggering refresh after background period');
          
          // Wait for network stack to recover before making requests
          await new Promise(resolve => setTimeout(resolve, FOREGROUND_REFRESH_DELAY));
          
          // Refresh network state
          const networkAvailable = await refreshNetworkState();
          logCrashEvent('Foreground network refresh', {
            networkAvailable,
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:72',message:'Network state after foreground',data:{networkAvailable},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          if (networkAvailable) {
            console.log('[App] Network available, refreshing data');
            logCrashEvent('Foreground refresh start');
            
            // Notify all listeners that app resumed from background
            notifyForegroundResume();
            
            // Invalidate React Query queries
            queryClient.invalidateQueries([]);
          } else {
            console.log('[App] Network not available, waiting for network');
          }
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  // Listen for network restoration and refresh data
  useEffect(() => {
    const unsubscribe = addNetworkListener((isConnected) => {
      if (isConnected) {
        console.log('[App] Network restored, refreshing data');
        logCrashEvent('Network restored');
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/acb5d14a-8c7b-4e86-a207-c67239eea7e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:105',message:'Network restored - refreshing data',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Notify listeners that network was restored
        notifyNetworkRestored();
        
        // Invalidate queries to refetch
        queryClient.invalidateQueries([]);
      }
    });

    return unsubscribe;
  }, [queryClient]);

  return null;
}

export default function App() {
  // Initialize network state manager and Google Sign-In
  useEffect(() => {
    // Initialize network state manager first - this is critical for proper foreground/background handling
    initializeNetworkStateManager();
    console.log('[App] Network state manager initialized');
    logCrashEvent('App init');
    
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
    
    // Cleanup network state manager on unmount
    return () => {
      cleanupNetworkStateManager();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppAlertProvider>
            <AppStateHandler />
            <AuthProvider>
              <LocationProvider>
                <CartProvider>
                  <NotificationSetup />
                  <AppNavigator />
                </CartProvider>
              </LocationProvider>
            </AuthProvider>
          </AppAlertProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
