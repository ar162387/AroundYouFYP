import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Dimensions, RefreshControl, Alert } from 'react-native';
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
import { useTranslation } from 'react-i18next';
import AppLogo from '../../icons/AppLogo';
import * as merchantService from '../../services/merchant/merchantService';
import { VerificationFormSheet } from '../../components/merchant/VerificationFormSheet';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MerchantShopsScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [merchantAccount, setMerchantAccount] = useState<merchantService.MerchantAccount | null>(null);
  const [verificationFormVisible, setVerificationFormVisible] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);

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

  const loadMerchantAccount = async () => {
    if (!user) return;

    try {
      const { merchant, error } = await merchantService.getMerchantAccount(user.id);
      if (error && error.message) {
        console.error('Error loading merchant account:', error.message);
        return;
      }
      setMerchantAccount(merchant);
    } catch (error) {
      console.error('Error loading merchant account:', error);
    }
  };

  useEffect(() => {
    loadShops();
    loadMerchantAccount();
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

  // Periodic auto-refresh for real-time status updates
  useEffect(() => {
    if (!user) return;

    // Refresh every 30 seconds to update shop opening status in real-time
    const interval = setInterval(() => {
      if (!loading) {
        loadShops();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, loading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShops();
  };

  const handleCreateShop = () => {
    try {
      ReactNativeHapticFeedback.trigger('selection');
    } catch { }
    navigation.navigate('CreateShop', {});
  };

  const handleShopPress = (shop: MerchantShop) => {
    try {
      ReactNativeHapticFeedback.trigger('selection');
    } catch { }
    navigation.navigate('MerchantShopPortal', { shop });
  };

  const handleVerificationSubmit = async (data: merchantService.VerificationData) => {
    if (!user) return;

    setSubmittingVerification(true);
    try {
      const { merchant, error } = await merchantService.submitVerification(user.id, data);
      if (error) {
        Alert.alert(
          t('merchant.verification.submitError'),
          error.message || t('merchant.verification.submitErrorMessage')
        );
        return;
      }

      if (merchant) {
        setMerchantAccount(merchant);
        setVerificationFormVisible(false);
        Alert.alert(
          t('merchant.verification.submitSuccess'),
          t('merchant.verification.submitSuccessMessage')
        );
      }
    } catch (error: any) {
      Alert.alert(
        t('merchant.verification.submitError'),
        error.message || t('merchant.verification.submitErrorMessage')
      );
    } finally {
      setSubmittingVerification(false);
    }
  };

  const showVerificationWarning = merchantAccount && merchantAccount.status !== 'verified';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={[]}>
      <StatusBar barStyle="light-content" />


      {/* Gradient overlay behind notch/status bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, zIndex: 10 }} pointerEvents="none">
        <LinearGradient
          colors={["#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      <View className="flex-1">
        {/* Header Section with Gradient - 40% of screen */}
        <LinearGradient
          colors={["#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-5"
          style={{
            height: headerHeight,
            paddingTop: insets.top + 10,
            paddingBottom: overlapHeight + 20,
            justifyContent: 'flex-end',
          }}
        >
          <View className={`w-full ${isRTL ? 'items-end' : 'items-start'}`}>
            <View className="mb-4">
              <AppLogo size={60} color="rgba(255,255,255,0.9)" />
            </View>
            <Text className={`text-white text-3xl font-bold mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('merchant.shops.title')}</Text>
            <Text className={`text-white/90 text-base ${isRTL ? 'text-right' : 'text-left'}`}>{t('merchant.shops.subtitle')}</Text>
          </View>
        </LinearGradient>

        {/* White Content Section with Curved Top - 70% of screen, overlaps by 10% */}
        <View
          className="bg-white rounded-t-3xl absolute"
          style={{
            top: headerHeight - overlapHeight,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: 24,
              paddingTop: 12
            }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {/* Verification Warning Banner */}
            {showVerificationWarning && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (merchantAccount?.status === 'none') {
                    setVerificationFormVisible(true);
                  }
                }}
                className={`mx-4 mt-4 mb-4 p-4 rounded-xl border ${
                  merchantAccount?.status === 'pending'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <View className={`flex-row items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Text className="text-2xl mr-2">⚠️</Text>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold text-gray-900 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('merchant.verification.warningTitle')}
                    </Text>
                    <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {merchantAccount?.status === 'pending'
                        ? t('merchant.verification.warningMessagePending')
                        : t('merchant.verification.warningMessage')}
                    </Text>
                    {merchantAccount?.status === 'none' && (
                      <Text className={`text-sm text-blue-600 font-semibold mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('merchant.verification.warningTitle')} →
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
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
                  {t('merchant.shops.noShops')}
                </Text>
                <Text className="text-gray-500 text-base text-center mb-8 px-4">
                  {t('merchant.shops.noShopsDesc')}
                </Text>

                {/* Create Shop Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="bg-blue-600 rounded-xl items-center justify-center px-8 py-4 min-w-[200px]"
                  onPress={handleCreateShop}
                >
                  <Text className="text-white text-base font-bold">{t('merchant.shops.createFirst')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Shops List */
              <View className="px-4">
                {/* Shop Cards */}
                {shops.map((shop, index) => (
                  <View key={shop.id} style={{ marginBottom: index < shops.length - 1 ? 12 : 0 }}>
                    <MerchantShopCard
                      shop={shop}
                      onPress={() => handleShopPress(shop)}
                    />
                  </View>
                ))}

                {/* Create Shop Button at the end (when shops exist) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="bg-blue-600 rounded-xl items-center justify-center px-6 py-4 mt-4 mb-4 shadow-lg"
                  style={{ elevation: 4 }}
                  onPress={handleCreateShop}
                >
                  <Text className="text-white text-base font-bold">{t('merchant.shops.createNew')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Verification Form Sheet */}
      <VerificationFormSheet
        visible={verificationFormVisible}
        merchantAccount={merchantAccount}
        userEmail={user?.email}
        userName={user?.name}
        loading={submittingVerification}
        onClose={() => setVerificationFormVisible(false)}
        onSubmit={handleVerificationSubmit}
      />
    </SafeAreaView>
  );
}

