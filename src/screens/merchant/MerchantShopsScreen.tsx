import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getMerchantShops, type MerchantShop } from '../../services/merchant/shopService';
import MerchantShopCard from '../../components/merchant/MerchantShopCard';
import ShopListSkeleton from '../../skeleton/ShopListSkeleton';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MerchantShopsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Calculate heights: header 40%, white section 70%, overlap 10%
  const headerHeight = SCREEN_HEIGHT * 0.4;
  const whiteSectionHeight = SCREEN_HEIGHT * 0.7;
  const overlapHeight = SCREEN_HEIGHT * 0.1;

  const loadShops = async () => {
    if (!user) return;

    try {
      const { shops: fetchedShops, error } = await getMerchantShops(user.id);
      if (error) {
        console.error('Error loading shops:', error);
        return;
      }
      setShops(fetchedShops || []);
    } catch (error) {
      console.error('Error loading shops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, [user]);

  // Auto-refresh when screen comes into focus (e.g., returning from CreateShop)
  useFocusEffect(
    React.useCallback(() => {
      // Only refresh if we have a user and initial load is complete
      if (user && !loading) {
        // Small delay to ensure smooth transition
        const timer = setTimeout(() => {
          loadShops();
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [user, loading])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShops();
  };

  const handleCreateShop = () => {
    try {
      ReactNativeHapticFeedback.trigger('selection');
    } catch {}
    navigation.navigate('CreateShop', {});
  };

  const handleShopPress = (shop: MerchantShop) => {
    try {
      ReactNativeHapticFeedback.trigger('selection');
    } catch {}
    navigation.navigate('MerchantShopPortal', { shop });
  };

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

      <View className="flex-1">
        {/* Header Section with Gradient - 40% of screen */}
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5"
          style={{ 
            height: headerHeight,
            paddingTop: insets.top + 16,
            paddingBottom: overlapHeight + 16,
            justifyContent: 'center'
          }}
        >
          <Text className="text-white text-3xl font-bold mb-2">My Shops</Text>
          <Text className="text-white/90 text-base">Manage your shops and track performance</Text>
        </LinearGradient>

        {/* White Content Section with Curved Top - 70% of screen, overlaps by 10% */}
        <View 
          className="bg-white rounded-t-3xl absolute" 
          style={{ 
            top: headerHeight - overlapHeight,
            left: 0,
            right: 0,
            height: whiteSectionHeight,
            zIndex: 2
          }}
        >
          <ScrollView 
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            <View className="h-12" />

            {loading ? (
              <ShopListSkeleton count={3} />
            ) : shops.length === 0 ? (
              /* Empty State */
              <View className="px-6 py-12 items-center justify-center">
                {/* Large Icon */}
                <View className="mb-6">
                  <View className="w-32 h-32 rounded-full bg-gray-100 items-center justify-center">
                    <Text className="text-6xl">🏪</Text>
                  </View>
                </View>

                {/* Empty State Text */}
                <Text className="text-gray-900 text-2xl font-semibold mb-2 text-center">
                  No shops yet
                </Text>
                <Text className="text-gray-500 text-base text-center mb-8 px-4">
                  Create your first shop and start selling online to customers around you
                </Text>

                {/* Create Shop Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="bg-blue-600 rounded-xl items-center justify-center px-8 py-4 min-w-[200px]"
                  onPress={handleCreateShop}
                >
                  <Text className="text-white text-base font-bold">Create Your First Shop</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Shops List */
              <View className="px-4">
                {/* Shop Cards */}
                {shops.map((shop) => (
                  <MerchantShopCard
                    key={shop.id}
                    shop={shop}
                    onPress={() => handleShopPress(shop)}
                  />
                ))}

                {/* Create Shop Button at the end (when shops exist) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="bg-blue-600 rounded-xl items-center justify-center px-6 py-4 mt-2 mb-4 shadow-lg"
                  style={{ elevation: 4 }}
                  onPress={handleCreateShop}
                >
                  <Text className="text-white text-base font-bold">+ Create New Shop</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

