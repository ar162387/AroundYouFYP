import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import OrdersIcon from '../../icons/OrdersIcon';
import AddressIcon from '../../icons/AddressIcon';
import FavoriteIcon from '../../icons/FavoriteIcon';
import * as merchantService from '../../services/merchant/merchantService';
import { useTranslation } from 'react-i18next';
import LanguageActionSheet from '../../components/LanguageActionSheet';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isConsumerDefault, setIsConsumerDefault] = useState(true);
  const [isSwitchingToMerchant, setIsSwitchingToMerchant] = useState(false);
  const { user, signOut, setDefaultRole, getDefaultRole } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  useEffect(() => {
    loadDefaultRole();
  }, []);

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

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200">
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
              <View className="flex-row justify-between">
                <SquareAction
                  title={t('profile.orders')}
                  icon={<OrdersIcon size={32} color="#3B82F6" />}
                  onPress={() => navigation.navigate('Orders')}
                />
                <SquareAction
                  title={t('profile.favourites')}
                  icon={<FavoriteIcon size={32} color="#3B82F6" />}
                  onPress={() => { }}
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
            title={t('profile.pushNotifications')}
            right={
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                thumbColor={pushEnabled ? '#2563eb' : '#f4f3f4'}
                trackColor={{ true: '#93c5fd', false: '#d1d5db' }}
              />
            }
          />
          <Separator />
          <ListItem title={t('profile.termsPolicies')} onPress={() => { }} />
          <Separator />
          {user && (
            <>
              <ListItem
                title={t('profile.switchToMerchant')}
                onPress={handleSwitchToMerchant}
                right={isSwitchingToMerchant ? <ActivityIndicator size="small" color="#2563eb" /> : undefined}
              />
              <Separator />
              <ListItem
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
          <ListItem title={t('profile.suggestionComplaint')} onPress={() => { }} />
          <Separator />
          <ListItem title={t('profile.faqs')} onPress={() => { }} />
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
      className="w-[31%] aspect-square bg-white rounded-2xl items-center justify-center shadow"
    >
      <View className="mb-2">{icon}</View>
      <Text className="text-gray-800 font-semibold text-sm text-center">{title}</Text>
    </TouchableOpacity>
  );
}

function ListItem({ title, right, onPress }: { title: string; right?: React.ReactNode; onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center justify-between px-4 py-4"
    >
      <Text className="text-gray-900 text-base font-medium">{title}</Text>
      {right}
    </TouchableOpacity>
  );
}

function Separator() {
  return <View className="h-px bg-gray-200 mx-4" />;
}
