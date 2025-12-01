import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import * as merchantService from '../../services/merchant/merchantService';
import { useTranslation } from 'react-i18next';
import LanguageActionSheet from '../../components/LanguageActionSheet';
import { VerificationFormSheet } from '../../components/merchant/VerificationFormSheet';
import * as notificationPreferencesService from '../../services/notificationPreferencesService';
import LinearGradient from 'react-native-linear-gradient';
import { getMerchantShops } from '../../services/merchant/shopService';
import LanguageIcon from '../../icons/LanguageIcon';
import NotificationIcon from '../../icons/NotificationIcon';
import DocumentIcon from '../../icons/DocumentIcon';
import SwitchIcon from '../../icons/SwitchIcon';
import SettingsIcon from '../../icons/SettingsIcon';
import FeedbackIcon from '../../icons/FeedbackIcon';
import DeleteIcon from '../../icons/DeleteIcon';
import HelpIcon from '../../icons/HelpIcon';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MerchantProfileScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const insets = useSafeAreaInsets();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [merchantAccount, setMerchantAccount] = useState<merchantService.MerchantAccount | null>(null);
  const [isLoadingMerchant, setIsLoadingMerchant] = useState(true);
  const [isConsumerDefault, setIsConsumerDefault] = useState(false);
  const [verificationFormVisible, setVerificationFormVisible] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const { user, signOut, setDefaultRole, getDefaultRole } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  const loadMerchantAccount = async () => {
    if (!user) {
      setIsLoadingMerchant(false);
      return;
    }

    try {
      const { merchant, error } = await merchantService.getMerchantAccount(user.id);
      if (error && error.message) {
        console.error('Error loading merchant account:', error.message);
      }
      setMerchantAccount(merchant);
    } catch (error) {
      console.error('Error loading merchant account:', error);
    } finally {
      setIsLoadingMerchant(false);
    }
  };

  const loadDefaultRole = async () => {
    try {
      if (getDefaultRole) {
        const role = await getDefaultRole();
        // isConsumerDefault = false means merchant is default
        setIsConsumerDefault(role !== 'merchant');
      } else {
        // Default to consumer if not set
        setIsConsumerDefault(true);
      }
    } catch (error) {
      console.error('Error loading default role:', error);
      setIsConsumerDefault(true);
    }
  };

  const loadShops = async () => {
    if (!user) return;
    setLoadingShops(true);
    try {
      const { shops: fetchedShops, error } = await getMerchantShops(user.id);
      if (error) {
        console.error('Error loading shops:', error);
        setShops([]);
      } else {
        setShops(fetchedShops || []);
      }
    } catch (error) {
      console.error('Error loading shops:', error);
      setShops([]);
    } finally {
      setLoadingShops(false);
    }
  };

  useEffect(() => {
    loadMerchantAccount();
    loadDefaultRole();
    if (user) {
      loadNotificationPreferences();
      loadShops();
    }
  }, [user]);

  // Refresh default role when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadDefaultRole();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleSwitchToConsumer = () => {
    Alert.alert(
      'Switch to Consumer',
      'Are you sure you want to switch to consumer mode?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Switch',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]
    );
  };

  const loadNotificationPreferences = async () => {
    if (!user) return;
    
    try {
      const { data } = await notificationPreferencesService.getNotificationPreferences(
        user.id,
        'merchant'
      );
      // Default to true if no preference exists
      setPushEnabled(data?.allow_push_notifications ?? true);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (!user) return;
    
    setPushEnabled(value);
    
    try {
      const { error } = await notificationPreferencesService.updateNotificationPreferences(
        user.id,
        'merchant',
        value
      );
      
      if (error) {
        // Revert on error
        setPushEnabled(!value);
        Alert.alert('Error', 'Failed to update notification preferences');
      }
    } catch (error) {
      // Revert on error
      setPushEnabled(!value);
      Alert.alert('Error', 'Failed to update notification preferences');
    }
  };

  const handleSetAsDefault = async (value: boolean) => {
    try {
      if (value) {
        // Setting merchant as default
        if (setDefaultRole) {
          await setDefaultRole('merchant');
        }
        setIsConsumerDefault(false);
        Alert.alert('Success', 'Merchant mode set as default');
      } else {
        // Disabling merchant default means setting consumer as default
        if (setDefaultRole) {
          await setDefaultRole('consumer');
        }
        setIsConsumerDefault(true);
        Alert.alert('Success', 'Consumer mode set as default');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set default role');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
              navigation.navigate('Home');
            } catch (error: any) {
              Alert.alert(
                'Logout Error',
                error?.message || 'Failed to logout. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const getStatusColor = (status: merchantService.MerchantStatus) => {
    switch (status) {
      case 'verified':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: merchantService.MerchantStatus) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending';
      default:
        return 'None';
    }
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


  const handlePrivacyPolicyPress = () => {
    navigation.navigate('PrivacyPolicy', { accountType: 'merchant' });
  };

  const handleDeleteAccount = () => {
    if (!user) return;

    // Check if there are shops
    if (shops.length > 0) {
      Alert.alert(
        t('profile.deleteAccount') || 'Delete Account',
        t('profile.deleteAccountMerchantPrerequisite', { count: shops.length }) || 
        `You must delete all ${shops.length} shop(s) before you can delete your merchant account.`,
        [{ text: t('profile.ok') || 'OK' }]
      );
      return;
    }

    Alert.alert(
      t('profile.deleteAccount') || 'Delete Account',
      t('profile.deleteAccountConfirmMessage') || 
      'Are you sure you want to delete your merchant account? This will permanently delete your verification status and all merchant-related data. This action cannot be undone.',
      [
        {
          text: t('profile.cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('profile.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              const { error } = await merchantService.deleteMerchantAccount(user.id);
              if (error) {
                Alert.alert(
                  t('profile.error') || 'Error',
                  error.message || t('profile.deleteAccountError') || 'Failed to delete account. Please try again.'
                );
                setIsDeletingAccount(false);
                return;
              }

              Alert.alert(
                t('profile.deleteAccountSuccess') || 'Account Deleted',
                t('profile.deleteAccountSuccessMessage') || 'Your merchant account has been deleted successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Switch to consumer home screen instead of logging out
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                      });
                    },
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert(
                t('profile.error') || 'Error',
                error.message || t('profile.deleteAccountError') || 'Failed to delete account. Please try again.'
              );
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
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
      <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200" style={{ paddingTop: insets.top + 48 }}>
        <Text className="text-2xl font-bold text-gray-900">{t('profile.title')}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {!user ? (
          <View className="px-4 mt-6">
            <View className="bg-white rounded-2xl p-6 mb-4">
              <Text className="text-gray-900 text-base text-center mb-4">
                {t('profile.notLoggedIn')}
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Verification Warning Banner */}
            {showVerificationWarning && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (merchantAccount?.status === 'none') {
                    setVerificationFormVisible(true);
                  }
                }}
                className={`mx-4 mt-3 mb-0 p-4 rounded-xl border ${
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

            {/* User Info */}
            <View className="bg-white px-4 py-5 mt-3">
              <Text className="text-gray-500 text-xs">{t('profile.name')}</Text>
              <Text className="text-gray-900 text-lg font-semibold mt-1">
                {user.name || t('profile.notSet')}
              </Text>

              <View className="h-3" />

              <Text className="text-gray-500 text-xs">{t('profile.email')}</Text>
              <Text className="text-gray-900 text-lg font-semibold mt-1">
                {user.email || t('profile.notSet')}
              </Text>

              {merchantAccount && (
                <>
                  <View className="h-3" />
                  <Text className="text-gray-500 text-xs">{t('profile.verificationStatus')}</Text>
                  <Text className={`text-lg font-semibold mt-1 ${getStatusColor(merchantAccount.status)}`}>
                    {merchantAccount.status === 'verified' ? t('profile.verified') :
                      merchantAccount.status === 'pending' ? t('profile.pending') :
                        t('profile.none')}
                  </Text>
                </>
              )}
            </View>

            {/* Settings List */}
            <View className="bg-white mt-4">
              <ListItem
                icon={<LanguageIcon size={20} color="#6B7280" />}
                title={t('profile.language')}
                right={<Text className="text-gray-500">{
                  i18n.language === 'ur' ? 'اردو' :
                    i18n.language === 'ur-roman' ? 'Urdu (Roman)' :
                      'English'
                }</Text>}
                onPress={() => {
                  console.log('Language option pressed (Merchant)');
                  setLanguageSheetVisible(true);
                }}
              />
              <Separator />
              <ListItem
                icon={<NotificationIcon size={20} color="#6B7280" />}
                title={t('profile.pushNotifications')}
                right={
                  <Switch
                    value={pushEnabled}
                    onValueChange={handleNotificationToggle}
                    thumbColor={pushEnabled ? '#2563eb' : '#f4f3f4'}
                    trackColor={{ true: '#93c5fd', false: '#d1d5db' }}
                    disabled={!user}
                  />
                }
              />
              <Separator />
              <ListItem 
                icon={<DocumentIcon size={20} color="#6B7280" />}
                title={t('profile.termsPolicies')} 
                onPress={handlePrivacyPolicyPress} 
              />
              <Separator />
              {user && (
                <>
                  <ListItem 
                    icon={<SwitchIcon size={20} color="#6B7280" />}
                    title={t('profile.switchToConsumer')} 
                    onPress={handleSwitchToConsumer} 
                  />
                  <Separator />
                  <ListItem
                    icon={<SettingsIcon size={20} color="#6B7280" />}
                    title={t('profile.setDefaultRole')}
                    right={
                      <Switch
                        value={!isConsumerDefault}
                        onValueChange={handleSetAsDefault}
                        disabled={false}
                        thumbColor={!isConsumerDefault ? '#2563eb' : '#f4f3f4'}
                        trackColor={{ true: '#93c5fd', false: '#d1d5db' }}
                      />
                    }
                  />
                  <Separator />
                </>
              )}
              <ListItem 
                icon={<FeedbackIcon size={20} color="#6B7280" />}
                title={t('profile.suggestionComplaint')} 
                onPress={() => navigation.navigate('SuggestionsComplaints')} 
              />
              <Separator />
              {user && (
                <>
                  <ListItem 
                    icon={<DeleteIcon size={20} color="#EF4444" />}
                    title={t('profile.deleteAccount') || 'Delete Account'} 
                    onPress={handleDeleteAccount}
                    right={
                      isDeletingAccount ? (
                        <ActivityIndicator size="small" color="#dc2626" />
                      ) : (
                        <Text className="text-red-600 text-sm">⚠️</Text>
                      )
                    }
                  />
                  <Separator />
                </>
              )}
              <ListItem 
                icon={<HelpIcon size={20} color="#6B7280" />}
                title={t('profile.faqs')} 
                onPress={() => navigation.navigate('MerchantFAQ')} 
              />
            </View>

            {/* Logout Button */}
            {user && (
              <View className="px-4 mt-6">
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="w-full bg-red-500 rounded-2xl items-center justify-center py-4"
                  onPress={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white text-base font-bold">{t('profile.logout')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </>
        )}
        <Text className="text-center text-gray-400 text-xs mt-2 px-4">{t('profile.version')} 0.1</Text>
      </ScrollView>

      <LanguageActionSheet
        visible={languageSheetVisible}
        onClose={() => setLanguageSheetVisible(false)}
      />

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
    </View >
  );
}

function ListItem({ icon, title, right, onPress }: { icon?: React.ReactNode; title: string; right?: React.ReactNode; onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center justify-between px-4 py-4"
    >
      <View className="flex-row items-center flex-1">
        {icon && <View className="mr-3">{icon}</View>}
        <Text className="text-gray-900 text-base font-medium">{title}</Text>
      </View>
      {right}
    </TouchableOpacity>
  );
}

function Separator() {
  return <View className="h-px bg-gray-200 mx-4" />;
}

