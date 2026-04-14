import React from 'react';
import { View, Text, TouchableOpacity, Image, Switch } from 'react-native';
import type { InventoryItem } from '../../../types/inventory';
import { formatPrice } from '../../../hooks/merchant/useInventoryItems';
import { useTranslation } from 'react-i18next';

type InventoryItemCardProps = {
  item: InventoryItem;
  onToggleActive: (itemId: string, nextActive: boolean) => void;
  onEdit: (item: InventoryItem) => void;
  onViewAudit: (item: InventoryItem) => void;
};

export function InventoryItemCard({ item, onToggleActive, onEdit, onViewAudit }: InventoryItemCardProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-white border border-gray-100 rounded-3xl p-4 flex-row items-start">
      <TouchableOpacity
        className="flex-1 flex-row space-x-5"
        onPress={() => onEdit(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${t('merchant.inventory.common.edit')} ${item.name}`}
      >
        <View className="w-24 h-24 rounded-3xl bg-gray-100 items-center justify-center overflow-hidden">
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <Text className="text-gray-400 font-semibold text-lg">{item.name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View className="flex-1 justify-between min-h-[96px] py-1 pr-2">
          <View>
            <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
              {item.name}
            </Text>
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

          <TouchableOpacity
            onPress={() => onViewAudit(item)}
            className="px-3 py-2 rounded-lg border border-gray-200 self-start mt-4"
            accessibilityRole="button"
            accessibilityLabel={t('merchant.inventory.tabs.audit')}
          >
            <Text className="text-xs font-semibold text-gray-600">{t('merchant.inventory.tabs.audit')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <View className="items-end pl-1" style={{ minWidth: 56 }}>
        <TouchableOpacity onPress={() => onEdit(item)} activeOpacity={0.7} accessibilityRole="button">
          <Text className="text-lg font-semibold text-gray-900">{formatPrice(item.priceCents, item.currency)}</Text>
        </TouchableOpacity>
        <Switch
          style={{ marginTop: 8 }}
          value={item.isActive}
          onValueChange={(next) => onToggleActive(item.id, next)}
          trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
          thumbColor={item.isActive ? '#16a34a' : '#f4f4f5'}
          ios_backgroundColor="#e5e7eb"
          accessibilityLabel={
            item.isActive ? t('merchant.inventory.form.active') : t('merchant.inventory.form.inactive')
          }
        />
      </View>
    </View>
  );
}
