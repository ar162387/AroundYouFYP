import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../navigation/types';
import type { MerchantShop } from '../../../../services/merchant/shopService';
import { deleteShop } from '../../../../services/merchant/shopService';
import { useAuth } from '../../../../context/AuthContext';
import { useTranslation } from 'react-i18next';

type SettingsSectionProps = {
  shop: MerchantShop;
  onShopDeleted?: () => void;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsSection({ shop, onShopDeleted }: SettingsSectionProps) {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditShop = () => {
    navigation.navigate('EditShop', { shop });
  };

  const handleDeleteShop = () => {
    Alert.alert(
      t('merchant.settings.deleteShopTitle'),
      t('merchant.settings.deleteShopMessage', { shopName: shop.name }),
      [
        {
          text: t('merchant.settings.cancel'),
          style: 'cancel',
        },
        {
          text: t('merchant.settings.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!user) {
              Alert.alert(t('merchant.settings.error'), t('merchant.settings.userNotFound'));
              return;
            }

            setIsDeleting(true);
            try {
              const { error } = await deleteShop(shop.id, user.id);
              if (error) {
                Alert.alert(
                  t('merchant.settings.error'),
                  error.message || t('merchant.settings.deleteError')
                );
                setIsDeleting(false);
                return;
              }

              Alert.alert(
                t('merchant.settings.success'),
                t('merchant.settings.deleteSuccess'),
                [
                  {
                    text: t('merchant.settings.ok'),
                    onPress: () => {
                      if (onShopDeleted) {
                        onShopDeleted();
                      } else {
                        navigation.goBack();
                      }
                    },
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert(
                t('merchant.settings.error'),
                error.message || t('merchant.settings.deleteError')
              );
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="space-y-4">
      {/* Shop Information Section */}
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <View className={`flex-row items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Text className={`text-xl font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('merchant.settings.shopInformation')}
          </Text>
          <TouchableOpacity
            onPress={handleEditShop}
            className="bg-blue-600 px-4 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">{t('merchant.settings.edit')}</Text>
          </TouchableOpacity>
        </View>

        <View className="space-y-4">
          {/* Name */}
          <View>
            <Text className={`text-xs text-gray-500 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('merchant.settings.name')}
            </Text>
            <Text className={`text-base text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
              {shop.name}
            </Text>
          </View>

          {/* Description */}
          <View>
            <Text className={`text-xs text-gray-500 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('merchant.settings.description')}
            </Text>
            <Text className={`text-base text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
              {shop.description}
            </Text>
          </View>

          {/* Shop Type */}
          <View>
            <Text className={`text-xs text-gray-500 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('merchant.settings.shopType')}
            </Text>
            <Text className={`text-base text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t(`shopTypes.${shop.shop_type}`)}
            </Text>
          </View>

          {/* Tags */}
          {shop.tags && shop.tags.length > 0 && (
            <View>
              <Text className={`text-xs text-gray-500 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('merchant.settings.tags')}
              </Text>
              <View className={`flex-row flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {shop.tags.map((tag, index) => (
                  <View
                    key={index}
                    className="bg-gray-100 px-3 py-1.5 rounded-full"
                  >
                    <Text className="text-sm text-gray-700">{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Delete Shop Section */}
      <View className="bg-white border border-red-200 rounded-3xl p-6 shadow-sm">
        <Text className={`text-lg font-semibold text-red-600 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('merchant.settings.dangerZone')}
        </Text>
        <Text className={`text-sm text-gray-600 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('merchant.settings.deleteShopWarning')}
        </Text>
        <TouchableOpacity
          onPress={handleDeleteShop}
          disabled={isDeleting}
          className={`bg-red-600 rounded-xl py-3 px-4 items-center justify-center ${isDeleting ? 'opacity-50' : ''}`}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {t('merchant.settings.deleteShop')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

