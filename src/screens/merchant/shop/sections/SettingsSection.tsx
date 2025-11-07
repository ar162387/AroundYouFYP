import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { MerchantShop } from '../../../../services/merchant/shopService';

type SettingsSectionProps = {
  shop: MerchantShop;
};

export default function SettingsSection({ shop }: SettingsSectionProps) {
  return (
    <View className="space-y-4">
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <Text className="text-xl font-semibold text-gray-900">Shop preferences</Text>
        <Text className="text-sm text-gray-500 mt-2">
          Configure branding, availability, payout routing, and compliance workflows for {shop.name}.
        </Text>
      </View>

      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-3">
        <TouchableOpacity className="flex-row items-center justify-between" onPress={() => {}}>
          <Text className="text-base text-gray-700">General details</Text>
          <Text className="text-sm font-semibold text-blue-600">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center justify-between" onPress={() => {}}>
          <Text className="text-base text-gray-700">Operating hours</Text>
          <Text className="text-sm font-semibold text-blue-600">Configure</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center justify-between" onPress={() => {}}>
          <Text className="text-base text-gray-700">Teams &amp; permissions</Text>
          <Text className="text-sm font-semibold text-blue-600">Invite</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

