import React from 'react';
import { FlashList, ListRenderItem } from '@shopify/flash-list';
import { View } from 'react-native';
import type { InventoryItem } from '../../../types/inventory';
import { InventoryItemCard } from './InventoryItemCard';

type InventoryListProps = {
  items: InventoryItem[];
  estimatedItemSize?: number;
  onToggleActive: (itemId: string, nextActive: boolean) => void;
  onEditItem: (item: InventoryItem) => void;
  onViewAudit: (item: InventoryItem) => void;
};

export function InventoryList({
  items,
  estimatedItemSize = 140,
  onToggleActive,
  onEditItem,
  onViewAudit,
}: InventoryListProps) {
  const renderItem: ListRenderItem<InventoryItem> = ({ item }) => (
    <InventoryItemCard
      item={item}
      onToggleActive={onToggleActive}
      onEdit={onEditItem}
      onViewAudit={onViewAudit}
    />
  );

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      estimatedItemSize={estimatedItemSize}
      ItemSeparatorComponent={() => <View className="h-4" />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 4 }}
    />
  );
}


