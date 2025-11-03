import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export default function MerchantOrdersScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-4 mt-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">Orders</Text>
          <View className="bg-white rounded-xl p-6">
            <Text className="text-gray-500">No orders yet.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

