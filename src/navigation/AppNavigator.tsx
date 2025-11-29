import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList } from './types';
import { navigationRef } from './navigationRef';

import MarketIcon from '../icons/MarketIcon';
import SearchIcon from '../icons/SearchIcon';
import CartIcon from '../icons/CartIcon';
import ProfileIcon from '../icons/ProfileIcon';
import { useCart } from '../context/CartContext';



import SplashScreen from '../screens/SplashScreen';
import HomeScreen from '../screens/consumer/HomeScreen';
import ProfileScreen from '../screens/consumer/ProfileScreen';
import SearchScreen from '../screens/consumer/SearchScreen';
import ShopScreen from '../screens/consumer/ShopScreen';
import CategoryItemsScreen from '../screens/consumer/CategoryItemsScreen';
import AddressSearchScreen from '../screens/consumer/AddressSearchScreen';
import ConsumerAddressManagementScreen from '../screens/consumer/ConsumerAddressManagementScreen';
import CartsManagementScreen from '../screens/consumer/CartsManagementScreen';
import ViewCartScreen from '../screens/consumer/ViewCartScreen';
import CheckoutScreen from '../screens/consumer/CheckoutScreen';
import OrderStatusScreen from '../screens/consumer/OrderStatusScreen';
import OrdersListScreen from '../screens/consumer/OrdersListScreen';
import MapTestScreen from '../screens/MapTestScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import LocationPermissionScreen from '../screens/LocationPermissionScreen';
import FirstLaunchMapScreen from '../screens/FirstLaunchMapScreen';
import MerchantRegistrationSurveyScreen from '../screens/merchant/MerchantRegistrationSurveyScreen';
import MerchantDashboard from '../screens/merchant/MerchantDashboard';
import CreateShopScreen from '../screens/merchant/CreateShopScreen';
import EditShopScreen from '../screens/merchant/EditShopScreen';
import ShopAddressMapScreen from '../screens/merchant/ShopAddressMapScreen';
import MerchantShopPortalScreen from '../screens/merchant/shop/MerchantShopPortalScreen';
import ManageDeliveryAreasScreen from '../screens/merchant/shop/ManageDeliveryAreasScreen';
import MerchantOrderScreen from '../screens/merchant/orders/MerchantOrderScreen';
import ShoppingAssistantScreen from '../screens/consumer/ShoppingAssistantScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
  const { carts } = useCart();
  const totalCarts = Object.keys(carts).length;

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
          tabBarLabel: 'Market',
          tabBarIcon: ({ color }) => <MarketIcon color={color} />,
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
        name="CartsTab"
        component={CartsManagementScreen}
        options={{
          tabBarLabel: 'Carts',
          tabBarBadge: totalCarts > 0 ? totalCarts : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 'bold',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            marginTop: 2,
          },
          tabBarIcon: ({ color }) => <CartIcon color={color} />,
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
    <NavigationContainer ref={navigationRef}>
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
          name="Shop"
          component={ShopScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="CategoryItems"
          component={CategoryItemsScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
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
          name="ViewCart"
          component={ViewCartScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="OrderStatus"
          component={OrderStatusScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="Orders"
          component={OrdersListScreen}
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
          name="EditShop"
          component={EditShopScreen}
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
          name="MerchantOrder"
          component={MerchantOrderScreen}
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
        <Stack.Screen
          name="ShoppingAssistant"
          component={ShoppingAssistantScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

