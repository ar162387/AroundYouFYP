import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

type InventoryEmptyStateProps = {
  onAddItem: () => void;
  onBrowseTemplates: () => void;
};

export function InventoryEmptyState({ onAddItem, onBrowseTemplates }: InventoryEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-white border border-dashed border-blue-200 rounded-3xl p-6 items-center justify-center">
      <Text className="text-base font-semibold text-blue-600">{t('merchant.inventory.items.emptyTitle')}</Text>
      <Text className="text-sm text-gray-500 mt-3 text-center">
        {t('merchant.inventory.items.emptyDesc')}
      </Text>
      <View className="flex-row space-x-3 mt-5">
        <TouchableOpacity className="bg-blue-600 px-6 py-3 rounded-xl" onPress={onAddItem}>
          <Text className="text-white font-semibold">{t('merchant.inventory.common.addNewItem')}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="bg-white border border-gray-200 px-6 py-3 rounded-xl" onPress={onBrowseTemplates}>
          <Text className="text-gray-700 font-semibold">{t('merchant.inventory.common.chooseTemplate')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


