import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LocationProvider>
          <AppNavigator />
        </LocationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
