import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { LocationProvider } from './src/context/LocationContext';
import { AuthProvider } from './src/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationProvider>
          <AppNavigator />
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

