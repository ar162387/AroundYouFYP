import { createRef } from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Navigation ref for use outside NavigationContainer (e.g., in notification handlers)
export const navigationRef = createRef<NavigationContainerRef<RootStackParamList>>();

