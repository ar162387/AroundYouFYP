import React from 'react';
import { FlashList } from '@shopify/flash-list';
import { View, Text, TouchableOpacity } from 'react-native';
import type { InventoryCategory } from '../../../types/inventory';

type InventoryCategoryListProps = {
  categories: InventoryCategory[];
  onEditCategory: (category: InventoryCategory) => void;
};

export function InventoryCategoryList({ categories, onEditCategory }: InventoryCategoryListProps) {
  return (
    <FlashList
      data={categories}
      keyExtractor={(category) => category.id}
      estimatedItemSize={72}
      ItemSeparatorComponent={() => <View className="h-3" />}
      contentContainerStyle={{ paddingVertical: 4 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          className="bg-white border border-gray-100 rounded-3xl p-4"
          onPress={() => onEditCategory(item)}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
              {item.description ? <Text className="text-xs text-gray-500 mt-1">{item.description}</Text> : null}
            </View>
            <View className="items-end">
              <Text className="text-xs text-gray-400">{item.itemCount} items</Text>
              <View
                className={`px-2 py-1 rounded-lg mt-2 ${item.isCustom ? 'bg-amber-50' : 'bg-purple-50'}`}
              >
                <Text className={`text-[10px] font-semibold ${item.isCustom ? 'text-amber-600' : 'text-purple-600'}`}>
                  {item.isCustom ? 'Custom' : 'Template linked'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}


