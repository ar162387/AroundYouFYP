import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function MerchantOrdersScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-4 mt-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">{t('merchant.orders.title')}</Text>
          <View className="bg-white rounded-xl p-6">
            <Text className="text-gray-500">{t('merchant.orders.noOrders')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

