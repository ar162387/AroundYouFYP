import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MerchantShopsScreen from './MerchantShopsScreen';
import MerchantOrdersScreen from './MerchantOrdersScreen';
import MerchantProfileScreen from './MerchantProfileScreen';
import OrdersIcon from '../../icons/OrdersIcon';
import ProfileIcon from '../../icons/ProfileIcon';
import ShopIcon from '../../icons/ShopIcon';

const Tab = createBottomTabNavigator();

export default function MerchantDashboard() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { height: 72, paddingBottom: 10, paddingTop: 10 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="MerchantShops"
        component={MerchantShopsScreen}
        options={{
          tabBarLabel: 'Shops',
          tabBarIcon: ({ color }) => <ShopIcon size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="MerchantOrders"
        component={MerchantOrdersScreen}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color }) => <OrdersIcon size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="MerchantProfile"
        component={MerchantProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

