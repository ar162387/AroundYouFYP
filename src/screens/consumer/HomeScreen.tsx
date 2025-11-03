import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Header from '../../components/consumer/Header';
import AddressBottomSheet from '../../components/consumer/AddressBottomSheet';
import CategoryIcon from '../../components/CategoryIcon';
import ShopCard from '../../components/consumer/ShopCard';
import type { Shop } from '../../services/supabase';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import LinearGradient from 'react-native-linear-gradient';

// Dummy data for shops
const DUMMY_SHOPS: Shop[] = [
  {
    id: '1',
    name: 'Fresh Mart Grocery',
    image_url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800',
    rating: 4.5,
    orders: 1240,
    delivery_fee: 199,
    delivery_time: '10-15 mins',
    tags: ['Grocery', 'Fresh Produce', 'Organic'],
    address: '123 Main St, 2 km away',
    is_open: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Meat & Veggie Palace',
    image_url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800',
    rating: 4.8,
    orders: 980,
    delivery_fee: 149,
    delivery_time: '15-20 mins',
    tags: ['Meat', 'Vegetables', 'Halal'],
    address: '456 Oak Ave, 1.5 km away',
    is_open: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Office Supplies Plus',
    image_url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800',
    rating: 4.3,
    orders: 350,
    delivery_fee: 299,
    delivery_time: '20-25 mins',
    tags: ['Stationery', 'Office', 'School Supplies'],
    address: '789 Pine Rd, 3 km away',
    is_open: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Green Valley Market',
    image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
    rating: 4.7,
    orders: 1670,
    delivery_fee: 179,
    delivery_time: '12-18 mins',
    tags: ['Organic', 'Farm Fresh', 'Local'],
    address: '321 Elm St, 2.5 km away',
    is_open: true,
    created_at: new Date().toISOString(),
  },
];

const SHOP_TYPES = [
  { name: 'Grocery', emoji: '🛒' },
  { name: 'Meat & Veg', emoji: '🥩' },
  { name: 'Stationery', emoji: '📚' },
];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { addressLine, placeLabel, loading: locationLoading } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const [sheetVisible, setSheetVisible] = React.useState(false);
  const [showStickySearch, setShowStickySearch] = React.useState(false);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const TAB_BAR_HEIGHT = 72;
  const insets = useSafeAreaInsets();

  // Animated values for the collapsible banner
  const BANNER_MAX_HEIGHT = 170;
  const LOCATION_HEADER_HEIGHT = 80; // Approximate height of location header
  const SEARCH_BAR_HEIGHT = 80; // Approximate height of search bar
  
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

  // Animate scrollable search bar opacity (fades out when sticky appears)
  const scrollableSearchOpacity = scrollY.interpolate({
    inputRange: [LOCATION_HEADER_HEIGHT - 20, LOCATION_HEADER_HEIGHT + 20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Animate sticky search bar opacity (fades in when scrolled past location header)
  const stickySearchOpacity = scrollY.interpolate({
    inputRange: [LOCATION_HEADER_HEIGHT - 20, LOCATION_HEADER_HEIGHT + 20],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={[]}>
      <StatusBar barStyle="light-content" />
      {/* Gradient overlay behind notch/status bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, zIndex: 10 }} pointerEvents="none">
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </View>
      
      {/* Fixed Sticky Search Bar - appears when scrolled past location header */}
      <Animated.View
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          zIndex: 20,
          elevation: 8,
          opacity: stickySearchOpacity,
          pointerEvents: showStickySearch ? 'auto' : 'none',
        }}
      >
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
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
          // Show sticky search when scrolled past location header
          setShowStickySearch(y > LOCATION_HEADER_HEIGHT);
        }}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}
      >
        {/* Primary Header (Location + icons) - gradient - scrolls away */}
        <Animated.View
          style={{
            opacity: locationHeaderOpacity,
          }}
        >
          <Header
            onFavPress={() => console.log('Favorites pressed')}
            onCartPress={() => console.log('Cart pressed')}
            onLocationPress={() => setSheetVisible(true)}
            locationLabel={
              selectedAddress?.label ||
              (locationLoading ? 'Fetching your location…' : (placeLabel || 'Select your address'))
            }
          />
        </Animated.View>

        {/* Scrollable Search Bar - fades out when sticky appears */}
        <Animated.View
          style={{
            opacity: scrollableSearchOpacity,
            zIndex: 10,
            elevation: 4,
          }}
        >
          <LinearGradient
            colors={["#1e3a8a", "#3b82f6"]}
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

        {/* Secondary/Dynamic Header Content (Banner) - gradient and collapses away */}
        <Animated.View style={{ height: bannerHeight, overflow: 'hidden' }}>
          <LinearGradient
            colors={["#1e3a8a", "#3b82f6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="px-5 h-full justify-center"
          >
            <Animated.View style={{ opacity: bannerOpacity }}>
              <View className="bg-white/10 rounded-2xl px-4 py-5">
                <Text className="text-white text-2xl font-semibold">
                  Order anything Online from the Shops AroundYou
                </Text>
                <Text className="text-white/90 mt-2">Fast delivery • Local shops • Best offers</Text>
        </View>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Curved white content container overlapping header to keep curves visible */}
        <View className="bg-white rounded-t-3xl" style={{ marginTop: -36, position: 'relative', zIndex: 2 }}>
          <View className="h-12" />

        {/* Categories - Horizontal carousel */}
        <View className="px-4 py-4">
        
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-4 px-4"
          >
            {SHOP_TYPES.map((category, index) => (
              <CategoryIcon
                key={index}
                name={category.name}
                emoji={category.emoji}
                onPress={() => console.log(`${category.name} pressed`)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Nearby Shops */}
        <View className="px-4 py-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-900 text-xl font-semibold">
              Nearby Shops
            </Text>
            
          </View>

          {/* Shop Cards */}
          {DUMMY_SHOPS.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              onPress={() => console.log(`${shop.name} pressed`)}
            />
          ))}
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
        </View>
      </Animated.ScrollView>


      <AddressBottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </SafeAreaView>
  );
}

