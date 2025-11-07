import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import type { InventoryItem } from '../../../types/inventory';
import { formatPrice } from '../../../hooks/merchant/useInventoryItems';

type InventoryItemCardProps = {
  item: InventoryItem;
  onToggleActive: (itemId: string, nextActive: boolean) => void;
  onEdit: (item: InventoryItem) => void;
  onViewAudit: (item: InventoryItem) => void;
};

export function InventoryItemCard({ item, onToggleActive, onEdit, onViewAudit }: InventoryItemCardProps) {
  return (
    <TouchableOpacity
      className="bg-white border border-gray-100 rounded-3xl p-4 flex-row space-x-5 items-center"
      onPress={() => onEdit(item)}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}`}
    >
      <View className="w-24 h-24 rounded-3xl bg-gray-100 items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Text className="text-gray-400 font-semibold text-lg">{item.name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <View className="flex-1 justify-between h-full py-1">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
              {item.name}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">SKU: {item.sku || '—'}</Text>
            {item.categories.length > 0 ? (
              <View className="flex-row flex-wrap mt-1">
                {item.categories.slice(0, 2).map((category) => (
                  <View key={category.id} className="bg-blue-50 px-2 py-1 rounded-lg mr-2 mt-1">
                    <Text className="text-xs text-blue-600">{category.name}</Text>
                  </View>
                ))}
                {item.categories.length > 2 && (
                  <View className="bg-blue-50 px-2 py-1 rounded-lg mr-2 mt-1">
                    <Text className="text-xs text-blue-600">+{item.categories.length - 2}</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
          <View className="items-end">
            <Text className="text-lg font-semibold text-gray-900">{formatPrice(item.priceCents, item.currency)}</Text>
            <TouchableOpacity
              onPress={() => onToggleActive(item.id, !item.isActive)}
              className={`px-3 py-1 rounded-full mt-2 ${item.isActive ? 'bg-green-50' : 'bg-gray-100'}`}
            >
              <Text className={`text-xs font-semibold ${item.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                {item.isActive ? 'Active' : 'Hidden'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row justify-between items-center mt-4">
          <TouchableOpacity
            onPress={() => onViewAudit(item)}
            className="px-3 py-2 rounded-lg border border-gray-200"
          >
            <Text className="text-xs font-semibold text-gray-600">View Audit</Text>
          </TouchableOpacity>
          {item.templateId ? (
            <View className="flex-row items-center bg-purple-50 px-2 py-1 rounded-md">
              <Text className="text-xs font-semibold text-purple-600">Template linked</Text>
            </View>
          ) : (
            <View className="flex-row items-center bg-amber-50 px-2 py-1 rounded-md">
              <Text className="text-xs font-semibold text-amber-600">Custom item</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}


