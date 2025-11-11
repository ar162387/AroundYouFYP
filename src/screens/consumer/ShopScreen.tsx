import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  FlatList,
  ActivityIndicator,
  Modal,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useQuery } from 'react-query';
import { fetchShopDetails, fetchShopCategories, fetchShopItems, ShopItem } from '../../services/consumer/shopService';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { calculateDistance, calculateDeliveryFee } from '../../services/merchant/deliveryLogicService';
import StarIcon from '../../icons/StarIcon';
import MoneyIcon from '../../icons/MoneyIcon';
import DeliveryRunnerIcon from '../../icons/DeliveryRunnerIcon';
import TagIcon from '../../icons/TagIcon';
import GiftIcon from '../../icons/GiftIcon';
import BackIcon from '../../icons/BackIcon';
import AroundYouSearchIcon from '../../icons/AroundYouSearchIcon';
import ShopScreenSkeleton from '../../skeleton/ShopScreenSkeleton';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Shop'>;

export default function ShopScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { shopId, shop: passedShop, distanceInMeters: passedDistance } = route.params;
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const userLat = coords?.latitude;
  const userLng = coords?.longitude;

  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY CONDITIONAL LOGIC
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryBarSticky, setCategoryBarSticky] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const categoryRefs = useRef<{ [key: string]: number }>({});
  const categoryBarY = useRef<number>(0);
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryChipRefs = useRef<{ [key: string]: { x: number; width: number } }>({});
  const categoryScrollX = useRef<number>(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState<number>(56);

  // Fetch shop details
  const { data: shopDetails, isLoading: shopLoading } = useQuery(['shopDetails', shopId], async () => {
    const result = await fetchShopDetails(shopId);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery(['shopCategories', shopId], async () => {
    const result = await fetchShopCategories(shopId);
    if (result.error) throw new Error(result.error.message);
    return result.data || [];
  });

  // Fetch all items
  const { data: allItems, isLoading: itemsLoading } = useQuery(['shopItems', shopId], async () => {
    const result = await fetchShopItems(shopId);
    if (result.error) throw new Error(result.error.message);
    return result.data || [];
  });

  // Use passed distance/delivery fee from HomeScreen, or calculate if not provided
  // Use the same coordinates as HomeScreen (from selectedAddress or userLocation)
  const { selectedAddress } = useLocationSelection();
  const effectiveCoords = selectedAddress?.coords || coords;
  
  // Calculate distance only if we have valid coordinates and shop details
  const calculateDistanceIfNeeded = () => {
    if (passedDistance !== undefined) {
      return passedDistance;
    }
    
    if (!shopDetails || !effectiveCoords?.latitude || !effectiveCoords?.longitude) {
      return null;
    }
    
    if (!shopDetails.latitude || !shopDetails.longitude) {
      console.warn('Shop missing coordinates:', shopDetails.id);
      return null;
    }
    
    // Validate coordinates are reasonable (not 0, not NaN, within valid ranges)
    const validLat = Math.abs(effectiveCoords.latitude) <= 90 && Math.abs(shopDetails.latitude) <= 90;
    const validLng = Math.abs(effectiveCoords.longitude) <= 180 && Math.abs(shopDetails.longitude) <= 180;
    
    if (!validLat || !validLng) {
      console.warn('Invalid coordinates:', {
        user: { lat: effectiveCoords.latitude, lng: effectiveCoords.longitude },
        shop: { lat: shopDetails.latitude, lng: shopDetails.longitude },
      });
      return null;
    }
    
    const calculatedDistance = calculateDistance(
      effectiveCoords.latitude,
      effectiveCoords.longitude,
      shopDetails.latitude,
      shopDetails.longitude
    );
    
    // Sanity check: if distance is > 100km, something is wrong
    if (calculatedDistance > 100000) {
      console.error('Calculated distance seems wrong (>100km):', {
        calculatedDistance,
        userCoords: { lat: effectiveCoords.latitude, lng: effectiveCoords.longitude },
        shopCoords: { lat: shopDetails.latitude, lng: shopDetails.longitude },
      });
      return null;
    }
    
    return calculatedDistance;
  };
  
  const distanceInMeters = calculateDistanceIfNeeded();

  // Use delivery fee from passed shop (already calculated on HomeScreen), or calculate if not provided
  const deliveryFee = passedShop?.delivery_fee ?? (shopDetails?.deliveryLogic && distanceInMeters
    ? calculateDeliveryFee(distanceInMeters, shopDetails.deliveryLogic)
    : null);

  // Show free delivery info if user is within free delivery radius
  const showFreeDeliveryInfo =
    shopDetails?.deliveryLogic && distanceInMeters !== null && distanceInMeters > 0
      ? distanceInMeters <= shopDetails.deliveryLogic.freeDeliveryRadius
      : false;

  console.log('ShopScreen delivery info:', {
    passedShop: !!passedShop,
    passedDistance,
    passedDeliveryFee: passedShop?.delivery_fee,
    effectiveCoords: effectiveCoords ? { lat: effectiveCoords.latitude, lng: effectiveCoords.longitude } : null,
    shopCoords: shopDetails ? { lat: shopDetails.latitude, lng: shopDetails.longitude } : null,
    distanceInMeters,
    deliveryFee,
    freeDeliveryRadius: shopDetails?.deliveryLogic?.freeDeliveryRadius,
    showFreeDeliveryInfo,
  });

  // Filter out inactive items and group by category
  const itemsByCategory = React.useMemo(() => {
    if (!categories || !allItems) return {};

    // First, filter out inactive items
    const activeItems = allItems.filter((item) => item.is_active === true);

    // Group active items by category
    const grouped: { [categoryId: string]: ShopItem[] } = {};
    categories.forEach((cat: { id: string }) => {
      const categoryItems = activeItems
        .filter((item) => item.categories.includes(cat.id))
        .slice(0, 10);
      // Only include category if it has at least one active item
      if (categoryItems.length > 0) {
        grouped[cat.id] = categoryItems;
      }
    });

    return grouped;
  }, [categories, allItems]);

  // Filter categories to only show those with active items
  const categoriesWithItems = React.useMemo(() => {
    if (!categories) return [];
    return categories.filter((cat: { id: string }) => {
      const items = itemsByCategory[cat.id];
      return items && items.length > 0;
    });
  }, [categories, itemsByCategory]);

  // Scroll to category and center it in the category bar if it's not fully visible
  const scrollToCategory = (categoryId: string) => {
    const position = categoryRefs.current[categoryId];
    if (position !== undefined && scrollViewRef.current) {
      setSelectedCategoryId(categoryId);
      
      // Calculate offset accounting for the sticky category bar height
      const stickyBarHeight = 56;
      const scrollPosition = position - stickyBarHeight;
      
      scrollViewRef.current.scrollTo({ 
        y: Math.max(0, scrollPosition), 
        animated: true 
      });

      // Center the tapped category in the horizontal scroll view if it's overflowed
      if (categoryScrollRef.current) {
        const chipInfo = categoryChipRefs.current[categoryId];
        if (chipInfo) {
          const scrollViewWidth = SCREEN_WIDTH - 24; // Account for padding
          const padding = 12; // Horizontal padding
          const currentScrollX = categoryScrollX.current;
          
          // Calculate chip position relative to visible viewport
          const chipLeft = chipInfo.x - currentScrollX;
          const chipRight = chipLeft + chipInfo.width;
          const visibleLeft = padding;
          const visibleRight = SCREEN_WIDTH - padding;

          // Check if chip is overflowed to left or right
          const isOverflowedLeft = chipLeft < visibleLeft;
          const isOverflowedRight = chipRight > visibleRight;

          if (isOverflowedLeft || isOverflowedRight) {
            // Center the chip
            const targetOffset = Math.max(0, chipInfo.x - (scrollViewWidth / 2) + (chipInfo.width / 2));
            
            categoryScrollRef.current.scrollTo({
              x: targetOffset,
              animated: true,
            });
            categoryScrollX.current = targetOffset;
          }
        } else {
          // Fallback: use estimation if measurement not available
          const categoryIndex = categoriesWithItems?.findIndex((cat: { id: string }) => cat.id === categoryId);
          if (categoryIndex !== undefined && categoryIndex !== -1) {
            const estimatedChipWidth = 100;
            const scrollViewWidth = SCREEN_WIDTH - 24;
            const targetOffset = Math.max(0, (categoryIndex * estimatedChipWidth) - (scrollViewWidth / 2) + (estimatedChipWidth / 2));
            
            categoryScrollRef.current.scrollTo({
              x: targetOffset,
              animated: true,
            });
            categoryScrollX.current = targetOffset;
          }
        }
      }
    }
  };

  if (shopLoading) {
    return <ShopScreenSkeleton />;
  }

  if (!shopDetails) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-600">Shop not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4 bg-blue-600 px-6 py-3 rounded-full">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Animated header opacity
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100, 150],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" />

      {/* Floating Back Button */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          zIndex: 100,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            try {
              navigation.goBack();
            } catch (error) {
              console.error('Navigation error:', error);
            }
          }}
          className="w-10 h-10 rounded-full bg-black/60 items-center justify-center"
          style={{ 
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          }}
        >
          <BackIcon size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Animated Header with Shop Name (appears on scroll) */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          opacity: headerOpacity,
        }}
        onLayout={(event) => {
          setHeaderHeight(event.nativeEvent.layout.height);
        }}
      >
        <LinearGradient colors={['#1e3a8a', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <View style={{ paddingTop: insets.top, paddingBottom: 0, paddingHorizontal: 20 }}>
            <View className="flex-row items-center pt-3 pb-3">
              <View className="w-10" />
              <Text className="flex-1 text-white text-xl font-bold text-center" numberOfLines={1}>
                {shopDetails.name}
              </Text>
              <View className="w-10" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Sticky Category Bar - appears when scrolled past */}
      {categoryBarSticky && categoriesWithItems && categoriesWithItems.length > 0 && (
        <View
          style={{
            position: 'absolute',
            top: isHeaderVisible ? headerHeight : insets.top,
            left: 0,
            right: 0,
            zIndex: 80,
            backgroundColor: '#4B5563',
          }}
        >
          <ScrollView
            ref={categoryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-3 py-3"
            contentContainerStyle={{ paddingRight: 12 }}
            onScroll={(e) => {
              categoryScrollX.current = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
          >
            {categoriesWithItems.map((category: { id: string; name: string }, index: number) => (
              <React.Fragment key={category.id}>
                <TouchableOpacity
                  onLayout={(event) => {
                    const { x, width } = event.nativeEvent.layout;
                    categoryChipRefs.current[category.id] = { x, width };
                  }}
                  onPress={() => scrollToCategory(category.id)}
                  className="px-4 py-2"
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedCategoryId === category.id ? 'text-blue-400' : 'text-gray-300'
                    }`}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
                {index < categoriesWithItems.length - 1 && (
                  <View className="w-px h-5 bg-gray-500 self-center" />
                )}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      )}

      <Animated.ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollY.setValue(y);
          
          // Track if header is visible
          setIsHeaderVisible(y > 150);
          
          // Make category bar sticky when scrolled past it
          if (categoryBarY.current > 0) {
            setCategoryBarSticky(y > categoryBarY.current - insets.top);
          }
        }}
      >
        {/* Hero Banner with Shop Image */}
        <View className="relative">
          {shopDetails.image_url ? (
            <Image
              source={{ uri: shopDetails.image_url }}
              style={{ width: SCREEN_WIDTH, height: 200 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: SCREEN_WIDTH, height: 200 }} className="bg-gradient-to-br from-blue-500 to-blue-700" />
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 100,
            }}
          />

          {/* Shop Name & Info Overlay */}
          <View className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <Text className="text-white text-2xl font-bold mb-1">{shopDetails.name}</Text>
            <View className="flex-row items-center">
              <StarIcon size={16} color="#FCD34D" filled />
              <Text className="text-white ml-1 text-sm">
                {shopDetails.rating > 0 ? shopDetails.rating.toFixed(1) : 'New'} · {shopDetails.orders} orders
              </Text>
            </View>
          </View>
        </View>

        {/* Info Cards - Grid Layout */}
        <View className="px-4 py-3 bg-white" style={{ width: SCREEN_WIDTH }}>
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {/* Delivery Fee - First Card */}
            {deliveryFee !== null && (
              <View className="bg-blue-50 rounded-xl px-3 py-2.5 mb-2" style={{ width: '48%', marginHorizontal: '1%' }}>
                <View className="flex-row items-center">
                  <DeliveryRunnerIcon size={16} color="#3B82F6" />
                  <View className="ml-1.5 flex-1">
                    <Text className="text-blue-700 text-xs font-semibold">
                      {deliveryFee > 0 ? `Rs ${Math.round(deliveryFee)} delivery` : 'Free delivery'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Minimum Order Value */}
            {shopDetails.deliveryLogic && (
              <View className="bg-green-50 rounded-xl px-3 py-2.5 mb-2" style={{ width: '48%', marginHorizontal: '1%' }}>
                <View className="flex-row items-center">
                  <MoneyIcon size={16} color="#10B981" />
                  <View className="ml-1.5 flex-1">
                    <Text className="text-green-700 text-xs font-semibold">
                      Min Order: Rs {shopDetails.deliveryLogic.minimumOrderValue}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Least Order Value */}
            {shopDetails.deliveryLogic && (
              <View className="bg-amber-50 rounded-xl px-3 py-2.5 mb-2" style={{ width: '48%', marginHorizontal: '1%' }}>
                <View className="flex-row items-center">
                  <TagIcon size={16} color="#F59E0B" />
                  <View className="ml-1.5 flex-1">
                    <Text className="text-amber-700 text-xs font-semibold">
                      Starts at: Rs {shopDetails.deliveryLogic.leastOrderValue}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Free Delivery Threshold */}
            {showFreeDeliveryInfo && shopDetails.deliveryLogic && (
              <View className="bg-pink-50 rounded-xl px-3 py-2.5 mb-2" style={{ width: '48%', marginHorizontal: '1%' }}>
                <View className="flex-row items-center">
                  <GiftIcon size={16} color="#EC4899" />
                  <View className="ml-1.5 flex-1">
                    <Text className="text-pink-700 text-xs font-semibold">
                      Free on Rs {shopDetails.deliveryLogic.freeDeliveryThreshold}+
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Search Bar */}
        <View className="px-4 pb-0 bg-white" style={{ width: SCREEN_WIDTH }}>
          <TouchableOpacity
            onPress={() => setSearchVisible(true)}
            className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3.5 border border-gray-200"
            activeOpacity={0.7}
          >
            <Text className="text-gray-400 text-lg mr-3">🔍</Text>
            <Text className="text-gray-500 text-base">Search for items...</Text>
          </TouchableOpacity>
        </View>

        {/* Category Navigation Bar - Becomes sticky on scroll */}
        {categoriesWithItems && categoriesWithItems.length > 0 && (
          <View
            className="bg-gray-700"
            style={{ width: SCREEN_WIDTH }}
            onLayout={(event) => {
              // Capture the Y position of the category bar
              categoryBarY.current = event.nativeEvent.layout.y;
            }}
          >
            <ScrollView
              ref={categoryScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="px-3 py-3"
              contentContainerStyle={{ paddingRight: 12 }}
              onScroll={(e) => {
                categoryScrollX.current = e.nativeEvent.contentOffset.x;
              }}
              scrollEventThrottle={16}
            >
              {categoriesWithItems.map((category: { id: string; name: string }, index: number) => (
                <React.Fragment key={category.id}>
                  <TouchableOpacity
                    onLayout={(event) => {
                      const { x, width } = event.nativeEvent.layout;
                      categoryChipRefs.current[category.id] = { x, width };
                    }}
                    onPress={() => scrollToCategory(category.id)}
                    className="px-4 py-2"
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        selectedCategoryId === category.id ? 'text-blue-400' : 'text-gray-300'
                      }`}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                  {index < categoriesWithItems.length - 1 && (
                    <View className="w-px h-5 bg-gray-500 self-center" />
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Product Display by Category */}
        <View className="bg-gray-50 pt-2">
          {itemsLoading || categoriesLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#2563eb" />
              <Text className="text-gray-600 mt-4">Loading items...</Text>
            </View>
          ) : categoriesWithItems && categoriesWithItems.length > 0 ? (
            categoriesWithItems.map((category: { id: string; name: string }) => (
              <View
                key={category.id}
                onLayout={(event) => {
                  categoryRefs.current[category.id] = event.nativeEvent.layout.y;
                }}
                className="mb-4"
              >
                {/* Category Header */}
                <View className="flex-row items-center justify-between px-4 mb-3 mt-3">
                  <Text className="text-xl font-bold text-gray-900">{category.name}</Text>
                  {itemsByCategory[category.id] && itemsByCategory[category.id].length > 0 && (
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('CategoryItems', {
                          shopId,
                          categoryId: category.id,
                          categoryName: category.name,
                        })
                      }
                      className="flex-row items-center"
                    >
                      <Text className="text-blue-600 font-semibold mr-1">See all</Text>
                      <Text className="text-blue-600">→</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Items Horizontal List */}
                {itemsByCategory[category.id] && itemsByCategory[category.id].length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 24 }}
                  >
                    {itemsByCategory[category.id].map((item) => (
                      <View key={item.id} className="mr-3 items-center" style={{ width: 155 }}>
                        {/* Item Image with Card Style */}
                        <View className="relative">
                          {item.image_url ? (
                            <View
                              className="bg-white rounded-2xl overflow-hidden items-center justify-center"
                              style={{
                                width: 140,
                                height: 140,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 3,
                              }}
                            >
                              <Image
                                source={{ uri: item.image_url }}
                                style={{ width: 120, height: 120 }}
                                resizeMode="contain"
                                onError={(error) => {
                                  console.log('Image load error for item:', item.name, item.image_url, error.nativeEvent.error);
                                }}
                                onLoad={() => {
                                  console.log('Image loaded successfully:', item.name, item.image_url);
                                }}
                              />
                              {/* Plus Button */}
                              <TouchableOpacity
                                className="absolute bottom-2 right-2 bg-blue-600 rounded-full w-8 h-8 items-center justify-center"
                                style={{
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.2,
                                  shadowRadius: 4,
                                  elevation: 4,
                                }}
                                activeOpacity={0.8}
                              >
                                <Text className="text-white text-lg font-bold">+</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View
                              className="bg-gray-50 rounded-2xl overflow-hidden items-center justify-center"
                              style={{
                                width: 140,
                                height: 140,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 3,
                              }}
                            >
                              <View className="w-20 h-20 rounded-full bg-gray-200 items-center justify-center">
                                <Text className="text-gray-400 text-2xl font-bold">
                                  {item.name.slice(0, 1).toUpperCase()}
                                </Text>
                              </View>
                              {/* Plus Button */}
                              <TouchableOpacity
                                className="absolute bottom-2 right-2 bg-blue-600 rounded-full w-8 h-8 items-center justify-center"
                                style={{
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.2,
                                  shadowRadius: 4,
                                  elevation: 4,
                                }}
                                activeOpacity={0.8}
                              >
                                <Text className="text-white text-lg font-bold">+</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Item Name - Centered, Lighter, 3 lines */}
                        <View className="mt-3 px-2 w-full">
                          <Text
                            className="text-sm text-gray-600 text-center leading-tight"
                            numberOfLines={3}
                            style={{ minHeight: 48 }}
                          >
                            {item.name}
                          </Text>
                        </View>

                        {/* Price - Centered */}
                        <View className="mt-1">
                          <Text className="text-base font-bold text-gray-900 text-center">
                            Rs {(item.price_cents / 100).toFixed(0)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View className="px-4 py-6 bg-white rounded-2xl mx-4">
                    <Text className="text-gray-500 text-center">No items in this category</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View className="py-12 items-center">
              <Text className="text-gray-600 text-center px-8">
                No categories or items available yet. Check back soon!
              </Text>
            </View>
          )}

          <View className="h-8" />
        </View>
      </Animated.ScrollView>

      {/* Floating Search Button - Bottom Right */}
      <TouchableOpacity
        onPress={() => setSearchVisible(true)}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          right: 20,
          zIndex: 80,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#1e40af',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#1e40af',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 10,
        }}
        activeOpacity={0.85}
      >
        <AroundYouSearchIcon size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Search Overlay Modal */}
      <Modal visible={searchVisible} animationType="slide" transparent={false}>
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
          {/* Search Bar at Top */}
          <View className="bg-white px-4 py-3 flex-row items-center border-b border-gray-200">
            <TouchableOpacity 
              onPress={() => setSearchVisible(false)} 
              className="mr-3 w-8 h-8 items-center justify-center"
            >
              <BackIcon size={20} color="#374151" />
            </TouchableOpacity>
            <TextInput
              className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base"
              placeholder="Search for items..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
          </View>

          {/* Search Results */}
          {searchQuery.trim() ? (
            <SearchResults shopId={shopId} searchQuery={searchQuery.trim()} onClose={() => setSearchVisible(false)} />
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-6xl mb-4">🔍</Text>
              <Text className="text-gray-900 text-lg font-semibold mb-2">Search for items</Text>
              <Text className="text-gray-500 text-center">
                Start typing to search through all available products
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// Search Results Component
function SearchResults({
  shopId,
  searchQuery,
  onClose,
}: {
  shopId: string;
  searchQuery: string;
  onClose: () => void;
}) {
  const { data: searchResults, isLoading } = useQuery(
    ['searchShopItems', shopId, searchQuery],
    async () => {
      const result = await fetchShopItems(shopId, undefined, searchQuery);
      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    },
    {
      enabled: searchQuery.length > 0,
    }
  );

  // Filter out inactive items from search results
  // MUST be called before any early returns to maintain hook order
  const activeSearchResults = React.useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter((item) => item.is_active === true);
  }, [searchResults]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={activeSearchResults}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="flex-row mb-3 items-center px-3 py-2 bg-white rounded-2xl relative" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}>
            {/* Image with Card Style */}
            <View className="mr-3">
              {item.image_url ? (
                <View
                  className="bg-white rounded-xl overflow-hidden items-center justify-center"
                  style={{
                    width: 80,
                    height: 80,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: 70, height: 70 }}
                    resizeMode="contain"
                    onError={(error) => {
                      console.log('Search image load error:', item.name, item.image_url, error.nativeEvent.error);
                    }}
                  />
                </View>
              ) : (
                <View
                  className="bg-gray-50 rounded-xl overflow-hidden items-center justify-center"
                  style={{
                    width: 80,
                    height: 80,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
                    <Text className="text-gray-400 text-lg font-bold">{item.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Item Info */}
            <View className="flex-1">
              <Text className="text-base text-gray-600 leading-tight" numberOfLines={3}>
                {item.name}
              </Text>
              <Text className="text-lg font-bold text-gray-900 mt-1">Rs {(item.price_cents / 100).toFixed(0)}</Text>
            </View>

            {/* Plus Button - Bottom Right of Card */}
            <TouchableOpacity
              className="absolute bottom-2 right-2 bg-blue-600 rounded-full w-7 h-7 items-center justify-center"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}
              activeOpacity={0.8}
            >
              <Text className="text-white text-sm font-bold">+</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Text className="text-5xl mb-3">📦</Text>
            <Text className="text-gray-900 font-semibold text-lg mb-2">No items found</Text>
            <Text className="text-gray-500 text-center">Try searching with a different keyword</Text>
          </View>
        }
      />
    </View>
  );
}

