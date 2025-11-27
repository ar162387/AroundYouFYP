import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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
import OpeningHoursSection from './sections/OpeningHoursSection';
import { useTranslation } from 'react-i18next';
import { getCurrentOpeningStatus } from '../../../utils/shopOpeningHours';
import type { MerchantShop } from '../../../services/merchant/shopService';
import { getMerchantShops } from '../../../services/merchant/shopService';
import { useAuth } from '../../../context/AuthContext';
import ReviewsSection from './sections/ReviewsSection';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MerchantShopPortal'>;

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'orders', label: 'Orders' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'openingHours', label: 'Opening Hours' },
  { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MerchantShopPortalScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { shop: initialShop } = route.params;
  const { user } = useAuth();

  const [shop, setShop] = useState<MerchantShop>(initialShop);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const activeIndexRef = useRef(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  const activeIndex = useMemo(() => TABS.findIndex((tab) => tab.key === activeTab), [activeTab]);

  // Refresh shop data periodically to get real-time opening status
  useEffect(() => {
    if (!user) return;

    const refreshShopData = async () => {
      try {
        const { shops, error } = await getMerchantShops(user.id);
        if (!error && shops) {
          const updatedShop = shops.find((s) => s.id === shop.id);
          if (updatedShop) {
            setShop(updatedShop); // This will have computed real-time is_open status
          }
        }
      } catch (error) {
        console.error('Error refreshing shop data:', error);
      }
    };

    // Refresh immediately on mount
    refreshShopData();

    // Refresh every 30 seconds to keep status up-to-date
    const interval = setInterval(refreshShopData, 30000);

    return () => clearInterval(interval);
  }, [user, shop.id]);

  const openingStatus = useMemo(() => {
    return getCurrentOpeningStatus({
      opening_hours: shop.opening_hours ?? null,
      holidays: shop.holidays ?? null,
      open_status_mode: shop.open_status_mode ?? undefined,
    });
  }, [shop]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      x: activeIndex * screenWidth,
      animated: true,
    });
  }, [activeIndex, screenWidth]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / screenWidth);
      const previousIndex = activeIndexRef.current;
      activeIndexRef.current = nextIndex;

      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        return;
      }

      if (nextIndex !== previousIndex && nextIndex >= 0 && nextIndex < TABS.length) {
        setActiveTab(TABS[nextIndex].key);
      }
    },
    [screenWidth]
  );

  const handleTabPress = useCallback(
    (tabKey: TabKey, index: number) => {
      activeIndexRef.current = index;
      isProgrammaticScrollRef.current = true;
      setActiveTab(tabKey);
      scrollRef.current?.scrollTo({
        x: index * screenWidth,
        animated: true,
      });
    },
    [screenWidth]
  );

  const renderSection = useCallback(
    (tabKey: TabKey) => {
      switch (tabKey) {
        case 'inventory':
          return <InventorySection shop={shop} />;
        case 'orders':
          return <OrdersSection shop={shop} />;
        case 'delivery':
          return <DeliverySection shop={shop} />;
        case 'reviews':
          return <ReviewsSection shop={shop} />;
        case 'openingHours':
          return (
            <OpeningHoursSection
              shop={shop}
              onShopUpdated={setShop}
            />
          );
        case 'settings':
          return (
            <SettingsSection
              shop={shop}
              onOpenOpeningHours={() => setActiveTab('openingHours')}
            />
          );
        case 'dashboard':
        default:
          return <DashboardSection shop={shop} onShowOrders={() => setActiveTab('orders')} />;
      }
    },
    [setActiveTab, shop]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, zIndex: 10 }} pointerEvents="none">
        <LinearGradient
          colors={["#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </View>

      <View className="flex-1">
        <LinearGradient
          colors={["#2563eb", "#1d4ed8"]}
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
              <View className="mt-2">
                <View
                  className={`px-3 py-1 rounded-full self-start ${
                    openingStatus.isOpen ? 'bg-emerald-500/20' : 'bg-red-500/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      openingStatus.isOpen ? 'text-emerald-100' : 'text-red-100'
                    }`}
                  >
                    {openingStatus.isOpen
                      ? t('merchant.openingHours.status.open')
                      : t('merchant.openingHours.status.closed')}
                  </Text>
                </View>
              </View>
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
              {TABS.map((tab, index) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    className={`mr-3 px-4 py-2 rounded-full border ${isActive ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                      }`}
                    onPress={() => handleTabPress(tab.key, index)}
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

          <View className="flex-1 overflow-hidden">
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              decelerationRate="fast"
              bounces={false}
            >
              {TABS.map((tab) => (
                <View key={tab.key} style={{ width: screenWidth, flex: 1 }}>
                  {tab.key === 'inventory' ? (
                    <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
                      {renderSection(tab.key)}
                    </View>
                  ) : (
                    <ScrollView
                      nestedScrollEnabled
                      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, paddingTop: 24 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {renderSection(tab.key)}
                    </ScrollView>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

