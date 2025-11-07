import React from 'react';
import { View, Text } from 'react-native';
import type { MerchantShop } from '../../../../services/merchant/shopService';

type OrdersSectionProps = {
  shop: MerchantShop;
};

export default function OrdersSection({ shop }: OrdersSectionProps) {
  return (
    <View className="space-y-4">
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <Text className="text-xl font-semibold text-gray-900">Live Orders</Text>
        <Text className="text-sm text-gray-500 mt-2">
          Order lifecycle, batching, and courier assignment tools for {shop.name} will show up here.
        </Text>
      </View>

      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <Text className="text-lg font-semibold text-gray-900">Fulfilment roadmap</Text>
        <Text className="text-sm text-gray-500 mt-2">
          We&apos;re designing a timeline view, SLA tracking, and escalation guardrails. This tab is scoped for high-volume ops teams.
        </Text>
      </View>
    </View>
  );
}

