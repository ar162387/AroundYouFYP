import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeIcon from '../icons/HomeIcon';
import SearchIcon from '../icons/SearchIcon';
import ProfileIcon from '../icons/ProfileIcon';

import type { RootStackParamList } from './types';

import SplashScreen from '../screens/SplashScreen';
import HomeScreen from '../screens/consumer/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import AddressSearchScreen from '../screens/consumer/AddressSearchScreen';
import ConsumerAddressManagementScreen from '../screens/consumer/ConsumerAddressManagementScreen';
import MapTestScreen from '../screens/MapTestScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import LocationPermissionScreen from '../screens/LocationPermissionScreen';
import FirstLaunchMapScreen from '../screens/FirstLaunchMapScreen';
import MerchantRegistrationSurveyScreen from '../screens/merchant/MerchantRegistrationSurveyScreen';
import MerchantDashboard from '../screens/merchant/MerchantDashboard';
import CreateShopScreen from '../screens/merchant/CreateShopScreen';
import ShopAddressMapScreen from '../screens/merchant/ShopAddressMapScreen';
import MerchantShopPortalScreen from '../screens/merchant/shop/MerchantShopPortalScreen';
import ManageDeliveryAreasScreen from '../screens/merchant/shop/ManageDeliveryAreasScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
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
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => <SearchIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Removed old emoji IconText in favor of themed SVG icons

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="MapTest" component={MapTestScreen} />
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen
          name="LocationPermission"
          component={LocationPermissionScreen}
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="FirstLaunchMap"
          component={FirstLaunchMapScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen name="Home" component={Tabs} />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddressSearch"
          component={AddressSearchScreen}
          options={{ 
            headerShown: false,
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="ConsumerAddressManagement"
          component={ConsumerAddressManagementScreen}
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ 
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ 
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="MerchantRegistrationSurvey"
          component={MerchantRegistrationSurveyScreen}
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="MerchantDashboard"
          component={MerchantDashboard}
          options={{ 
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="CreateShop"
          component={CreateShopScreen}
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ShopAddressMap"
          component={ShopAddressMapScreen}
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="MerchantShopPortal"
          component={MerchantShopPortalScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ManageDeliveryAreas"
          component={ManageDeliveryAreasScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

