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
import ReviewBottomSheet from '../../components/consumer/ReviewBottomSheet';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { useShopsByLocation } from '../../hooks/consumer/useShopsByLocation';
import { useUserOrders } from '../../hooks/consumer/useOrders';
import { hasReviewedShop } from '../../services/consumer/reviewService';
import LinearGradient from 'react-native-linear-gradient';
import ShopTypeImage from '../../icons/shopTypeRemote';
import type { ShopType } from '../../services/merchant/shopService';

type Nav = NativeStackNavigationProp<RootStackParamList>;


export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { addressLine, placeLabel, loading: locationLoading } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const { shops, loading: shopsLoading, error: shopsError, refetch } = useShopsByLocation();
  const { data: orders, refetch: refetchOrders } = useUserOrders();
  const [sheetVisible, setSheetVisible] = React.useState(false);
  const [reviewSheetVisible, setReviewSheetVisible] = React.useState(false);
  const [reviewSheetShop, setReviewSheetShop] = React.useState<{ id: string; name: string; orderId?: string } | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedShopType, setSelectedShopType] = React.useState<ShopType | null>(null);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const TAB_BAR_HEIGHT = 72;
  const insets = useSafeAreaInsets();

  // Shop type filter configuration - show only types present in available shops
  const SHOP_TYPE_ORDER: ShopType[] = ['Grocery', 'Meat', 'Vegetable', 'Stationery', 'Dairy', 'Pharmacy'];
  const AVAILABLE_TYPE_LABEL: Record<ShopType, string> = {
    Grocery: 'Grocery',
    Meat: 'Meat',
    Vegetable: 'Vegetable',
    Stationery: 'Stationery',
    Dairy: 'Dairy',
    Pharmacy: 'Pharmacy',
  };

  const availableShopTypes = React.useMemo<ShopType[]>(() => {
    const present = new Set<ShopType>();
    (shops || []).forEach((s) => {
      const st = s.shop_type as ShopType | undefined;
      if (st && AVAILABLE_TYPE_LABEL[st]) present.add(st);
    });
    return SHOP_TYPE_ORDER.filter((t) => present.has(t));
  }, [shops]);

  // If currently selected type becomes unavailable (e.g., after refresh), reset selection
  React.useEffect(() => {
    if (selectedShopType && !availableShopTypes.includes(selectedShopType)) {
      setSelectedShopType(null);
    }
  }, [availableShopTypes, selectedShopType]);

  // Filter shops by selected type
  const filteredShops = React.useMemo(() => {
    if (!selectedShopType) return shops;
    return shops.filter(shop => shop.shop_type === selectedShopType);
  }, [shops, selectedShopType]);

  // Handle shop type filter selection
  const handleShopTypeFilter = (type: ShopType) => {
    ReactNativeHapticFeedback.trigger('selection');
    if (selectedShopType === type) {
      // Deselect if already selected
      setSelectedShopType(null);
    } else {
      setSelectedShopType(type);
    }
  };

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
      if (refetchOrders) {
        await refetchOrders();
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchOrders]);

  // Track if we've shown the review prompt for a specific order
  const promptedOrderIds = React.useRef<Set<string>>(new Set());

  // Check for delivered orders that need review
  React.useEffect(() => {
    const checkForReviewPrompt = async () => {
      // Don't check if review sheet is already visible
      if (reviewSheetVisible) return;
      
      if (!orders || orders.length === 0) return;

      // Find the most recent delivered order that we haven't prompted for
      const deliveredOrders = orders
        .filter((order) => order.status === 'delivered' && !promptedOrderIds.current.has(order.id))
        .sort((a, b) => {
          const dateA = new Date(a.delivered_at || a.placed_at).getTime();
          const dateB = new Date(b.delivered_at || b.placed_at).getTime();
          return dateB - dateA;
        });

      if (deliveredOrders.length === 0) return;

      const mostRecentDeliveredOrder = deliveredOrders[0];
      
      // Check if this order was recently delivered (within last 24 hours)
      const deliveredAt = mostRecentDeliveredOrder.delivered_at 
        ? new Date(mostRecentDeliveredOrder.delivered_at).getTime()
        : null;
      
      if (!deliveredAt) return;
      
      const now = Date.now();
      const hoursSinceDelivery = (now - deliveredAt) / (1000 * 60 * 60);
      
      // Only show prompt for orders delivered in the last 24 hours
      if (hoursSinceDelivery > 24) {
        // Mark this order as checked so we don't check it again
        promptedOrderIds.current.add(mostRecentDeliveredOrder.id);
        return;
      }

      // Check if user has already reviewed this shop
      const { data: hasReviewed, error } = await hasReviewedShop(mostRecentDeliveredOrder.shop_id);
      
      if (!error && !hasReviewed) {
        // Mark this order as prompted
        promptedOrderIds.current.add(mostRecentDeliveredOrder.id);
        // Show review bottom sheet
        setReviewSheetShop({
          id: mostRecentDeliveredOrder.shop_id,
          name: mostRecentDeliveredOrder.shop.name,
          orderId: mostRecentDeliveredOrder.id,
        });
        setReviewSheetVisible(true);
      } else {
        // Mark this order as checked even if reviewed
        promptedOrderIds.current.add(mostRecentDeliveredOrder.id);
      }
    };

    checkForReviewPrompt();
  }, [orders, reviewSheetVisible]);

  const handleReviewSubmitted = React.useCallback(() => {
    setReviewSheetVisible(false);
    setReviewSheetShop(null);
    // Refetch orders to update UI
    if (refetchOrders) {
      refetchOrders();
    }
  }, [refetchOrders]);

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

          {/* Shop Type Filters - Horizontal Scroll */}
          <View className="px-4 pt-2 pb-4">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
              className="flex-row"
            >
              {availableShopTypes.map((type) => {
                const isSelected = selectedShopType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => handleShopTypeFilter(type)}
                    activeOpacity={0.7}
                    className="items-center mr-5 px-1"
                  >
                    <View
                      className={`rounded-xl items-center justify-center ${
                        isSelected ? 'border-2 border-blue-600 bg-blue-50' : 'border border-transparent'
                      }`}
                      style={{ width: 76, height: 76 }}
                    >
                      <ShopTypeImage
                        type={type}
                        size={40}
                        borderColor="transparent"
                        backgroundColor="transparent"
                      />
                    </View>
                    <Text
                      className={`text-sm mt-2 font-bold ${
                        isSelected ? 'text-blue-600' : 'text-gray-600'
                      }`}
                      numberOfLines={1}
                    >
                      {AVAILABLE_TYPE_LABEL[type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Nearby Shops */}
          <View className="px-4 py-5">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-gray-900 text-2xl font-extrabold">
                  Nearby Shops
                </Text>
                <View className="h-1 bg-blue-600 rounded-full mt-1 w-20" />
              </View>
              
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
            {!shopsLoading && !shopsError && filteredShops.length === 0 && (
              <View className="py-8 items-center">
                <Text className="text-gray-600 text-center">
                  {selectedShopType 
                    ? `No ${selectedShopType} shops found in your delivery area.`
                    : 'No shops found in your delivery area. Try selecting a different address.'}
                </Text>
              </View>
            )}

            {/* Shop Cards */}
            {!shopsLoading && !shopsError && filteredShops.map((shop) => {
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
      
      {/* Review Bottom Sheet */}
      {reviewSheetShop && (
        <ReviewBottomSheet
          visible={reviewSheetVisible}
          onClose={() => {
            setReviewSheetVisible(false);
            setReviewSheetShop(null);
          }}
          shopId={reviewSheetShop.id}
          shopName={reviewSheetShop.name}
          orderId={reviewSheetShop.orderId}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </SafeAreaView>
  );
}

