import React from 'react';
import { View, Text } from 'react-native';
import type { MerchantShop } from '../../../../services/merchant/shopService';

type DeliverySectionProps = {
  shop: MerchantShop;
};

export default function DeliverySection({ shop }: DeliverySectionProps) {
  return (
    <View className="space-y-4">
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <Text className="text-xl font-semibold text-gray-900">Delivery Playbooks</Text>
        <Text className="text-sm text-gray-500 mt-2">
          Configure service areas, capacity, and courier SLAs tailored to {shop.name}. Map tooling is in progress.
        </Text>
      </View>

      <View className="bg-white border border-dashed border-blue-200 rounded-3xl p-6 shadow-sm">
        <Text className="text-base font-semibold text-blue-600">Coming soon: delivery zones</Text>
        <Text className="text-sm text-gray-500 mt-2">
          You&apos;ll soon be able to drop polygons, price dynamic slots, and sync with Huawei thirdData for courier pickups.
        </Text>
      </View>
    </View>
  );
}

