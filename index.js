import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import './global.css';
import App from './App';

// React Native app name must match the MainActivity component name
AppRegistry.registerComponent('main', () => App);

// Register background handler for push notifications
// This must be registered at the top level, outside of the React component tree
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background notification received:', remoteMessage);
  const notification = remoteMessage?.notification;
  const data = remoteMessage?.data || {};
  // If FCM already contains a notification payload, Android system will display it.
  // We only render a local notification for data-only payloads.
  if (notification) {
    return;
  }
  const title = notification?.title || data?.title || data?.notification_title || 'New Notification';
  const body = notification?.body || data?.body || data?.message || '';

  if (!title && !body) {
    return;
  }

  await notifee.createChannel({
    id: 'order_notifications',
    name: 'Order Notifications',
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    id: `bg_${data.orderId || Date.now()}`,
    title,
    body,
    data,
    android: {
      channelId: 'order_notifications',
      smallIcon: 'ic_notification',
      pressAction: { id: 'default' },
      importance: AndroidImportance.HIGH,
    },
  });
});
