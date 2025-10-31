import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { LocationProvider } from './src/context/LocationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <LocationProvider>
        <AppNavigator />
      </LocationProvider>
    </SafeAreaProvider>
  );
}

