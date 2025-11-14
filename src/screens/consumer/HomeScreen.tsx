import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Header from '../../components/consumer/Header';
import AddressBottomSheet from '../../components/consumer/AddressBottomSheet';
import ShopCard from '../../components/consumer/ShopCard';
import ShopCardSkeleton from '../../skeleton/ShopCardSkeleton';
import ActiveOrderBanner from '../../components/consumer/ActiveOrderBanner';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { useShopsByLocation } from '../../hooks/consumer/useShopsByLocation';
import LinearGradient from 'react-native-linear-gradient';

type Nav = NativeStackNavigationProp<RootStackParamList>;


export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { addressLine, placeLabel, loading: locationLoading } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const { shops, loading: shopsLoading, error: shopsError, refetch } = useShopsByLocation();
  const [sheetVisible, setSheetVisible] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const TAB_BAR_HEIGHT = 72;
  const insets = useSafeAreaInsets();

  // Animated values for the collapsible banner
  const BANNER_MAX_HEIGHT = 170;
  const LOCATION_HEADER_HEIGHT = 80; // Approximate height of location header
  const SEARCH_BAR_HEIGHT = 70; // Approximate height of search bar
  
  const bannerHeight = scrollY.interpolate({
    inputRange: [0, BANNER_MAX_HEIGHT],
    outputRange: [BANNER_MAX_HEIGHT, 0],
    extrapolate: 'clamp',
  });
  const bannerOpacity = scrollY.interpolate({
    inputRange: [0, BANNER_MAX_HEIGHT * 0.7, BANNER_MAX_HEIGHT],
    outputRange: [1, 0.2, 0],
    extrapolate: 'clamp',
  });

  // Animate location header opacity as it scrolls away
  const locationHeaderOpacity = scrollY.interpolate({
    inputRange: [0, LOCATION_HEADER_HEIGHT * 0.7, LOCATION_HEADER_HEIGHT],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  // Calculate search bar position - starts right after header, moves to top (insets.top)
  const searchBarTop = scrollY.interpolate({
    inputRange: [0, LOCATION_HEADER_HEIGHT],
    outputRange: [insets.top + 60, insets.top], // Positioned tighter to header
    extrapolate: 'clamp',
  });

  // Handle pull to refresh
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      ReactNativeHapticFeedback.trigger('impactLight');
      // Refetch shops data
      if (refetch) {
        await refetch();
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={[]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Fixed Gradient Overlay for Safe Area - always visible at top */}
      <View 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: insets.top, 
          zIndex: 30,
        }} 
        pointerEvents="none"
      >
        <LinearGradient
          colors={["#1e3a8a", "#2563eb"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Sticky Search Bar - positioned absolutely, animates from natural position to top */}
      <Animated.View
        style={{
          position: 'absolute',
          top: searchBarTop,
          left: 0,
          right: 0,
          zIndex: 20,
          elevation: 8,
        }}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={["#1e3a8a", "#2563eb"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 pb-3"
        >
          <View className="pt-3" />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={async () => {
              try {
                ReactNativeHapticFeedback.trigger('selection');
              } catch {}
              navigation.navigate('Search');
            }}
            className="flex-row items-center bg-white/95 rounded-full px-4 py-3"
          >
            <Text className="text-gray-400 text-lg mr-2">🔍</Text>
            <Text className="text-gray-700 text-base flex-1">Search product, shop…</Text>
            <Text className="text-gray-600 text-lg">⚙️</Text>
          </TouchableOpacity>
          <View className="pb-2" />
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollY.setValue(y);
        }}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            progressViewOffset={LOCATION_HEADER_HEIGHT + SEARCH_BAR_HEIGHT + BANNER_MAX_HEIGHT}
          />
        }
      >
        {/* Primary Header (Location + icons) - gradient - scrolls away */}
        <View style={{ backgroundColor: '#2563eb' }}>
          <Animated.View
            style={{
              opacity: locationHeaderOpacity,
            }}
          >
            <Header
              onFavPress={() => console.log('Favorites pressed')}
              onLocationPress={() => setSheetVisible(true)}
              locationLabel={
                selectedAddress?.label ||
                (locationLoading ? 'Fetching your location…' : (placeLabel || 'Select your address'))
              }
            />
          </Animated.View>
        </View>

        {/* Spacer for search bar - maintains layout flow */}
        <View style={{ height: SEARCH_BAR_HEIGHT }}>
          <LinearGradient
            colors={["#1e3a8a", "#2563eb"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-full"
          />
        </View>

        {/* Secondary/Dynamic Header Content (Banner) - gradient and collapses away */}
        <Animated.View style={{ height: bannerHeight, overflow: 'hidden' }}>
          <LinearGradient
            colors={["#1e3a8a", "#2563eb"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="px-5 h-full justify-start"
          >
            <Animated.View style={{ opacity: bannerOpacity, paddingTop: 12 }}>
              <Text className="text-white text-2xl font-semibold">
                Order anything Online 
                from the Shops AroundYou
              </Text>
              <Text className="text-white/90 mt-2">Fast delivery • Local shops • Best offers</Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Curved white content container overlapping header to keep curves visible */}
        <View className="bg-white rounded-t-3xl" style={{ marginTop: -36, position: 'relative', zIndex: 2 }}>
          <View className="h-12" />

          {/* Nearby Shops */}
          <View className="px-4 py-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-xl font-semibold">
                Nearby Shops
              </Text>
              
            </View>

            {/* Loading State */}
            {shopsLoading && <ShopCardSkeleton count={3} />}

            {/* Error State */}
            {!shopsLoading && shopsError && (
              <View className="py-8 items-center">
                <Text className="text-red-600 text-center">{shopsError}</Text>
              </View>
            )}

            {/* Empty State */}
            {!shopsLoading && !shopsError && shops.length === 0 && (
              <View className="py-8 items-center">
                <Text className="text-gray-600 text-center">
                  No shops found in your delivery area. Try selecting a different address.
                </Text>
              </View>
            )}

            {/* Shop Cards */}
            {!shopsLoading && !shopsError && shops.map((shop) => {
              // Type assertion to access distanceInMeters that was added by calculateShopsDeliveryFees
              const shopWithDistance = shop as typeof shop & { distanceInMeters?: number };
              return (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  onPress={() => {
                    console.log('Navigating to shop:', {
                      shopId: shop.id,
                      shopName: shop.name,
                      deliveryFee: shop.delivery_fee,
                      distanceInMeters: shopWithDistance.distanceInMeters,
                    });
                    navigation.navigate('Shop', { 
                      shopId: shop.id,
                      shop: shop,
                      distanceInMeters: shopWithDistance.distanceInMeters,
                    });
                  }}
                />
              );
            })}
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </Animated.ScrollView>

      {/* Active Order Banner - sticky above tab bar */}
      <View
        style={{
          position: 'absolute',
          bottom: Math.max(16, TAB_BAR_HEIGHT - 36),
          left: 0,
          right: 0,
          zIndex: 10,
        }}
        pointerEvents="box-none"
      >
        <ActiveOrderBanner />
      </View>

      <AddressBottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </SafeAreaView>
  );
}

