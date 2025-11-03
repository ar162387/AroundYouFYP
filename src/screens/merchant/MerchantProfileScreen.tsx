import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import * as merchantService from '../../services/merchant/merchantService';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MerchantProfileScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [merchantAccount, setMerchantAccount] = useState<merchantService.MerchantAccount | null>(null);
  const [isLoadingMerchant, setIsLoadingMerchant] = useState(true);
  const [isConsumerDefault, setIsConsumerDefault] = useState(false);
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

  useEffect(() => {
    loadMerchantAccount();
    loadDefaultRole();
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
            navigation.navigate('Home');
          },
        },
      ]
    );
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

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="pt-12 pb-4 px-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {!user ? (
          <View className="px-4 mt-6">
            <View className="bg-white rounded-2xl p-6 mb-4">
              <Text className="text-gray-900 text-base text-center mb-4">
                Please Sign Up / Login
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* User Info */}
            <View className="bg-white px-4 py-5 mt-3">
              <Text className="text-gray-500 text-xs">Name</Text>
              <Text className="text-gray-900 text-lg font-semibold mt-1">
                {user.name || 'Not set'}
              </Text>

              <View className="h-3" />

              <Text className="text-gray-500 text-xs">Email</Text>
              <Text className="text-gray-900 text-lg font-semibold mt-1">
                {user.email || 'Not set'}
              </Text>

              {merchantAccount && (
                <>
                  <View className="h-3" />
                  <Text className="text-gray-500 text-xs">Verification Status</Text>
                  <Text className={`text-lg font-semibold mt-1 ${getStatusColor(merchantAccount.status)}`}>
                    {getStatusLabel(merchantAccount.status)}
                  </Text>
                </>
              )}
            </View>

            {/* Settings List */}
            <View className="bg-white mt-4">
              <ListItem
                title="Language"
                right={<Text className="text-gray-500">English</Text>}
                onPress={() => {}}
              />
              <Separator />
              <ListItem
                title="Push Notifications"
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
              <ListItem title="Terms & Policies" onPress={() => {}} />
              <Separator />
              {user && (
                <>
                  <ListItem title="Switch to Consumer" onPress={handleSwitchToConsumer} />
                  <Separator />
                  <ListItem
                    title="Set this role as default"
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
              <ListItem title="Suggestion or Complaint" onPress={() => {}} />
              <Separator />
              <ListItem title="FAQs" onPress={() => {}} />
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
                    <Text className="text-white text-base font-bold">Logout</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        <Text className="text-center text-gray-400 text-xs mt-2 px-4">Version 0.1</Text>
      </ScrollView>
    </View>
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

