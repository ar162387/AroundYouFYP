import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

type InventoryEmptyStateProps = {
  onAddItem: () => void;
  onBrowseTemplates: () => void;
};

export function InventoryEmptyState({ onAddItem, onBrowseTemplates }: InventoryEmptyStateProps) {
  return (
    <View className="bg-white border border-dashed border-blue-200 rounded-3xl p-6 items-center justify-center">
      <Text className="text-base font-semibold text-blue-600">Add your first item</Text>
      <Text className="text-sm text-gray-500 mt-3 text-center">
        Import from the grocery catalog or create a custom product tailored for your shop.
      </Text>
      <View className="flex-row space-x-3 mt-5">
        <TouchableOpacity className="bg-blue-600 px-6 py-3 rounded-xl" onPress={onAddItem}>
          <Text className="text-white font-semibold">Create custom</Text>
        </TouchableOpacity>
        <TouchableOpacity className="bg-white border border-gray-200 px-6 py-3 rounded-xl" onPress={onBrowseTemplates}>
          <Text className="text-gray-700 font-semibold">Browse templates</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


