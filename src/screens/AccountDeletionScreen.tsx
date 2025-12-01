import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import BackIcon from '../icons/BackIcon';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import * as merchantService from '../services/merchant/merchantService';
import { getMerchantShops } from '../services/merchant/shopService';
import * as authService from '../services/authService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AccountDeletion'>;
type Route = RouteProp<RootStackParamList, 'AccountDeletion'>;

const accountDeletionUrl = 'https://ar162387.github.io/aroundyou.github.io/account-deletion.html';

export default function AccountDeletionScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user, signOut } = useAuth();
  const accountType = route.params?.accountType || 'consumer';
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasShops, setHasShops] = useState(false);
  const [hasMerchantAccount, setHasMerchantAccount] = useState(false);
  const [shopCount, setShopCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user, accountType]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (accountType === 'merchant') {
        const { shops, error } = await getMerchantShops(user.id);
        if (!error && shops) {
          setHasShops(shops.length > 0);
          setShopCount(shops.length);
        }
      } else {
        const { merchant, error } = await merchantService.getMerchantAccount(user.id);
        if (!error && merchant) {
          setHasMerchantAccount(true);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const canDelete = accountType === 'merchant' 
    ? !hasShops 
    : !hasMerchantAccount;

  const handleDelete = async () => {
    if (!canDelete || !user) {
      return;
    }

    Alert.alert(
      t('profile.deleteAccountConfirmTitle') || 'Delete Account',
      t('profile.deleteAccountConfirmMessage') || 'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: t('profile.cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('profile.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              if (accountType === 'merchant') {
                const { error } = await merchantService.deleteMerchantAccount(user.id);
                if (error) {
                  throw new Error(error.message);
                }
                Alert.alert(
                  t('profile.deleteAccountSuccess') || 'Account Deleted',
                  t('profile.deleteAccountSuccessMessage') || 'Your merchant account has been deleted successfully.',
                  [
                    {
                      text: 'OK',
                      onPress: async () => {
                        await signOut();
                        navigation.navigate('Home');
                      },
                    },
                  ]
                );
              } else {
                // For consumers, delete merchant account if exists first
                if (hasMerchantAccount) {
                  const { error } = await merchantService.deleteMerchantAccount(user.id);
                  if (error) {
                    throw new Error(error.message);
                  }
                }
                
                // Now delete the consumer profile
                const { error: deleteError } = await authService.deleteUserProfile(user.id);
                if (deleteError) {
                  throw new Error(deleteError.message);
                }

                Alert.alert(
                  t('profile.deleteAccountSuccess') || 'Account Deleted',
                  t('profile.deleteAccountSuccessMessage') || 'Your account has been deleted successfully.',
                  [
                    {
                      text: 'OK',
                      onPress: async () => {
                        await signOut();
                        navigation.navigate('Home');
                      },
                    },
                  ]
                );
              }
            } catch (error: any) {
              Alert.alert(
                t('profile.error') || 'Error',
                error.message || t('profile.deleteAccountError') || 'Failed to delete account. Please try again.'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenDeletionPage = () => {
    Linking.openURL(accountDeletionUrl).catch((err) => {
      console.error('Failed to open URL:', err);
      Alert.alert('Error', 'Failed to open the account deletion page. Please visit: ' + accountDeletionUrl);
    });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Gradient overlay behind notch/status bar */}
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
          colors={["#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Header */}
      <SafeAreaView edges={['top']} className="bg-white border-b border-gray-200">
        <View className={`flex-row items-center px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`} style={{ paddingTop: insets.top + 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className={`w-10 h-10 rounded-full bg-gray-100 items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`}
            activeOpacity={0.7}
          >
            <BackIcon size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className={`text-gray-900 text-lg font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.deleteAccount') || 'Delete Account'}
            </Text>
            <Text className={`text-gray-500 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.deleteAccountSubtitle') || 'Permanently delete your account and data'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        {/* Warning Message */}
        <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <Text className={`text-red-800 font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.deleteAccountWarning') || '⚠️ Warning: This action is permanent!'}
          </Text>
          <Text className={`text-red-700 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.deleteAccountWarningMessage') || 'Deleting your account will permanently remove all your data. This cannot be undone.'}
          </Text>
        </View>

        {/* Prerequisites Check */}
        {!canDelete && (
          <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <Text className={`text-yellow-800 font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('profile.deleteAccountPrerequisites') || '⚠️ Prerequisites Not Met'}
            </Text>
            <Text className={`text-yellow-700 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              {accountType === 'merchant' 
                ? t('profile.deleteAccountMerchantPrerequisite', { count: shopCount }) || `You must delete all ${shopCount} shop(s) before you can delete your account.`
                : t('profile.deleteAccountConsumerPrerequisite') || 'You must delete your merchant account before you can delete your consumer account.'}
            </Text>
          </View>
        )}

        {/* What will be deleted */}
        <View className="mb-4">
          <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.whatWillBeDeleted') || 'What will be deleted:'}
          </Text>
          <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.deleteAccountInfo') || 'Your user account and profile information'}
            </Text>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.deleteAddresses') || 'Your saved delivery addresses'}
            </Text>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.deleteCartItems') || 'Your cart items and preferences'}
            </Text>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.deleteNotifications') || 'Your notification preferences'}
            </Text>
          </View>
        </View>

        {/* What may be retained */}
        <View className="mb-4">
          <Text className={`text-base font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.whatMayBeRetained') || 'What may be retained:'}
          </Text>
          <View className={`space-y-2 ${isRTL ? 'items-end' : 'items-start'}`}>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.retainTransactionRecords') || 'Transaction records (for legal compliance, typically 7 years)'}
            </Text>
            <Text className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              • {t('profile.retainAnonymizedData') || 'Anonymized data for analytics'}
            </Text>
          </View>
        </View>

        {/* Complete Deletion Link */}
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <Text className={`text-blue-800 font-semibold mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.completeDeletion') || 'Complete Account Deletion'}
          </Text>
          <Text className={`text-blue-700 text-sm mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('profile.completeDeletionMessage') || 'For complete account deletion including transaction records, please submit a formal request:'}
          </Text>
          <TouchableOpacity
            onPress={handleOpenDeletionPage}
            className="bg-blue-600 rounded-lg py-2 px-4 items-center"
          >
            <Text className="text-white font-semibold">
              {t('profile.submitDeletionRequest') || 'Submit Deletion Request'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <SafeAreaView edges={['bottom']} className="bg-white border-t border-gray-200 px-6 py-4">
        {accountType === 'merchant' ? (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={isDeleting}
              className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
            >
              <Text className="text-gray-900 font-semibold">
                {t('profile.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={!canDelete || isDeleting}
              className={`flex-1 bg-red-600 rounded-xl py-3 items-center ${(!canDelete || isDeleting) ? 'opacity-50' : ''}`}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">
                  {t('profile.deleteAccount') || 'Delete Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-full bg-gray-100 rounded-xl py-3 items-center"
          >
            <Text className="text-gray-900 font-semibold">
              {t('profile.cancel') || 'Cancel'}
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

