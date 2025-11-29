import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import './global.css';
import App from './App';

// React Native app name must match the MainActivity component name
AppRegistry.registerComponent('main', () => App);

// Register background handler for push notifications
// This must be registered at the top level, outside of the React component tree
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background notification received:', remoteMessage);
  // Background notifications are handled automatically by the system
  // Additional processing can be added here if needed
});
