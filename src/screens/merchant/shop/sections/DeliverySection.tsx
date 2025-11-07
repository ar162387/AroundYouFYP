import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MerchantShop } from '../../../../services/merchant/shopService';
import type { RootStackParamList } from '../../../../navigation/types';
import { useDeliveryAreas } from '../../../../hooks/merchant/useDeliveryAreas';

type DeliverySectionProps = {
  shop: MerchantShop;
};

export default function DeliverySection({ shop }: DeliverySectionProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: areas, isLoading } = useDeliveryAreas(shop.id);

  const areaSummary = useMemo(() => {
    if (!areas || areas.length === 0) {
      return {
        title: 'No zones set',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-600',
      };
    }

    return {
      title: `${areas.length} ${areas.length === 1 ? 'zone' : 'zones'}`,
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-600',
    };
  }, [areas]);

  return (
    <View className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900">Delivery Areas</Text>
          <Text className="text-xs text-gray-500 mt-1">
            Draw zones on the map to define where you deliver. Customers only see your shop if their location is within these zones.
          </Text>
        </View>
        <TouchableOpacity
          className="rounded-full bg-blue-600 px-4 py-2"
          onPress={() => navigation.navigate('ManageDeliveryAreas', { shop })}
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-white">Manage</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#2563eb" />
          <Text className="ml-2 text-xs text-gray-500">Loading zones...</Text>
        </View>
      ) : (
        <View className={`inline-flex self-start rounded-full px-3 py-1 ${areaSummary.badgeBg}`}>
          <Text className={`text-xs font-semibold ${areaSummary.badgeText}`}>
            {areaSummary.title}
          </Text>
        </View>
      )}
    </View>
  );
}

