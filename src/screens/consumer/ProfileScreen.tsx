import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import OrdersIcon from '../../icons/OrdersIcon';
import AddressIcon from '../../icons/AddressIcon';
import LanguageIcon from '../../icons/LanguageIcon';
import NotificationIcon from '../../icons/NotificationIcon';
import DocumentIcon from '../../icons/DocumentIcon';
import SwitchIcon from '../../icons/SwitchIcon';
import SettingsIcon from '../../icons/SettingsIcon';
import FeedbackIcon from '../../icons/FeedbackIcon';
import DeleteIcon from '../../icons/DeleteIcon';
import HelpIcon from '../../icons/HelpIcon';
import * as merchantService from '../../services/merchant/merchantService';
import { useTranslation } from 'react-i18next';
import LanguageActionSheet from '../../components/LanguageActionSheet';
import * as notificationPreferencesService from '../../services/notificationPreferencesService';
import LinearGradient from 'react-native-linear-gradient';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isConsumerDefault, setIsConsumerDefault] = useState(true);
  const [isSwitchingToMerchant, setIsSwitchingToMerchant] = useState(false);
  const [merchantAccount, setMerchantAccount] = useState<merchantService.MerchantAccount | null>(null);
  const [loadingMerchant, setLoadingMerchant] = useState(false);
  const { user, signOut, setDefaultRole, getDefaultRole } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  const loadMerchantAccount = async () => {
    if (!user) {
      setMerchantAccount(null);
      setLoadingMerchant(false);
      return;
    }

    setLoadingMerchant(true);
    try {
      const { merchant, error } = await merchantService.getMerchantAccount(user.id);
      if (error && error.message) {
        console.error('Error loading merchant account:', error.message);
      }
      setMerchantAccount(merchant);
    } catch (error) {
      console.error('Error loading merchant account:', error);
      setMerchantAccount(null);
    } finally {
      setLoadingMerchant(false);
    }
  };

  useEffect(() => {
    loadDefaultRole();
    if (user) {
      loadNotificationPreferences();
      loadMerchantAccount();
    }
  }, [user]);

  const loadDefaultRole = async () => {
    try {
      if (getDefaultRole) {
        const role = await getDefaultRole();
        setIsConsumerDefault(role === 'consumer');
      } else {
        setIsConsumerDefault(true);
      }
    } catch (error) {
      // Default to consumer if error
      setIsConsumerDefault(true);
    }
  };

  const handleSignInPress = () => {
    navigation.navigate('Login', { returnTo: 'Home' });
  };

  const handleSwitchToMerchant = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    setIsSwitchingToMerchant(true);
    try {
      // Check if merchant account exists
      const { merchant, error } = await merchantService.getMerchantAccount(user.id);

      if (error && error.message) {
        console.error('Error fetching merchant account:', error);
        Alert.alert('Error', error.message);
        setIsSwitchingToMerchant(false);
        return;
      }

      if (merchant) {
        // Merchant account exists, reset stack to merchant experience
        navigation.reset({
          index: 0,
          routes: [{ name: 'MerchantDashboard' }],
        });
      } else {
        // No merchant account, show registration survey
        navigation.navigate('MerchantRegistrationSurvey');
      }
    } catch (error: any) {
      console.error('Exception in handleSwitchToMerchant:', error);
      Alert.alert('Error', error.message || 'Failed to check merchant account');
    } finally {
      setIsSwitchingToMerchant(false);
    }
  };

  const loadNotificationPreferences = async () => {
    if (!user) return;
    
    try {
      const { data } = await notificationPreferencesService.getNotificationPreferences(
        user.id,
        'consumer'
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
        'consumer',
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

  const handleSetAsDefault = async () => {
    try {
      if (setDefaultRole) {
        await setDefaultRole('consumer');
      }
      setIsConsumerDefault(true);
      Alert.alert('Success', 'Consumer mode set as default');
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
              // Navigate to home after successful logout
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


  const handlePrivacyPolicyPress = () => {
    navigation.navigate('PrivacyPolicy', { accountType: 'consumer' });
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
          // Not logged in state
          <View className="px-4 mt-6">
            <View className="bg-white rounded-2xl p-6 mb-4">
              <Text className="text-gray-900 text-base text-center mb-4">
                {t('profile.notLoggedIn')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                className="w-full bg-blue-600 rounded-xl items-center justify-center py-4"
                onPress={handleSignInPress}
              >
                <Text className="text-white text-base font-bold">{t('profile.signUpLogin')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Logged in state
          <>
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
            </View>

            {/* Quick Actions */}
            <View className="px-4 mt-4">
              <View className="flex-row gap-3">
                <SquareAction
                  title={t('profile.orders')}
                  icon={<OrdersIcon size={32} color="#3B82F6" />}
                  onPress={() => navigation.navigate('Orders')}
                />
                <SquareAction
                  title={t('profile.addresses')}
                  icon={<AddressIcon size={32} color="#3B82F6" />}
                  onPress={() => navigation.navigate('ConsumerAddressManagement')}
                />
              </View>
            </View>
          </>
        )}

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
              console.log('Language option pressed');
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
                title={t('profile.switchToMerchant')}
                onPress={handleSwitchToMerchant}
                right={isSwitchingToMerchant ? <ActivityIndicator size="small" color="#2563eb" /> : undefined}
              />
              <Separator />
              <ListItem
                icon={<SettingsIcon size={20} color="#6B7280" />}
                title={t('profile.setDefaultRole')}
                right={
                  <Switch
                    value={isConsumerDefault}
                    onValueChange={(value) => {
                      if (value) {
                        handleSetAsDefault();
                      }
                    }}
                    thumbColor={isConsumerDefault ? '#2563eb' : '#f4f3f4'}
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
                onPress={() => navigation.navigate('AccountDeletion', { accountType: 'consumer' })}
                right={<Text className="text-red-600 text-sm">⚠️</Text>}
              />
              <Separator />
            </>
          )}
          <ListItem 
            icon={<HelpIcon size={20} color="#6B7280" />}
            title={t('profile.faqs')} 
            onPress={() => navigation.navigate('ConsumerFAQ')} 
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
        <Text className="text-center text-gray-400 text-xs mt-2 px-4">{t('profile.version')} 0.1</Text>
      </ScrollView>

      <LanguageActionSheet
        visible={languageSheetVisible}
        onClose={() => setLanguageSheetVisible(false)}
      />
    </View>
  );
}

function SquareAction({ title, icon, onPress }: { title: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-1 aspect-square bg-white rounded-2xl items-center justify-center shadow"
    >
      <View className="mb-2">{icon}</View>
      <Text className="text-gray-800 font-semibold text-sm text-center">{title}</Text>
    </TouchableOpacity>
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
