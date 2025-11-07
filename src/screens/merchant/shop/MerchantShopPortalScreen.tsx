import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../../../navigation/types';
import DashboardSection from './sections/DashboardSection';
import InventorySection from './sections/InventorySection';
import OrdersSection from './sections/OrdersSection';
import DeliverySection from './sections/DeliverySection';
import SettingsSection from './sections/SettingsSection';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MerchantShopPortal'>;

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'orders', label: 'Orders' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MerchantShopPortalScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { shop } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  const TabContent = useMemo(() => {
    switch (activeTab) {
      case 'inventory':
        return <InventorySection shop={shop} />;
      case 'orders':
        return <OrdersSection shop={shop} />;
      case 'delivery':
        return <DeliverySection shop={shop} />;
      case 'settings':
        return <SettingsSection shop={shop} />;
      case 'dashboard':
      default:
        return <DashboardSection shop={shop} />;
    }
  }, [activeTab, shop]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, zIndex: 10 }} pointerEvents="none">
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </View>

      <View className="flex-1">
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 pb-5"
          style={{ paddingTop: insets.top + 12 }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text className="text-white text-lg">{'<'}</Text>
            </TouchableOpacity>
            <View className="ml-4 flex-1">
              <Text className="text-white/80 text-xs uppercase tracking-widest">Shop workspace</Text>
              <Text className="text-white text-2xl font-bold" numberOfLines={1}>
                {shop.name}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View className="bg-white rounded-t-3xl flex-1">
          <View className="px-5 pt-5">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20 }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    className={`mr-3 px-4 py-2 rounded-full border ${isActive ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
                    onPress={() => setActiveTab(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
            {TabContent}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

