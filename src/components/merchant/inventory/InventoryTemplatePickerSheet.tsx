import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { InventoryTemplateItem } from '../../../types/inventory';
import { useInventoryTemplates } from '../../../hooks/merchant/useInventoryTemplates';
import InventoryTemplateItemSkeleton from '../../../skeleton/InventoryTemplateItemSkeleton';

type InventoryTemplatePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: InventoryTemplateItem) => void;
  existingTemplateIds: Set<string>;
};

export function InventoryTemplatePickerSheet({
  visible,
  onClose,
  onSelect,
  existingTemplateIds,
}: InventoryTemplatePickerSheetProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearch('');
    }
  }, [visible]);

  const { data, isLoading } = useInventoryTemplates(search);
  const templates = data ?? [];
  const orderedTemplates = useMemo(() => {
    if (!templates || templates.length === 0) {
      return [];
    }
    const available: InventoryTemplateItem[] = [];
    const already: InventoryTemplateItem[] = [];
    templates.forEach((template) => {
      if (template.id && existingTemplateIds.has(template.id)) {
        already.push(template);
      } else {
        available.push(template);
      }
    });
    return [...available, ...already];
  }, [templates, existingTemplateIds]);

  const renderItem = ({ item }: { item: InventoryTemplateItem }) => {
    const alreadyAdded = item.id ? existingTemplateIds.has(item.id) : false;

    return (
      <TouchableOpacity
        className="bg-white border border-gray-100 rounded-3xl p-4 flex-row space-x-4"
        onPress={() => {
          if (alreadyAdded) {
            Alert.alert('Already Added', 'This template is already in your inventory.');
            return;
          }
          onSelect(item);
          onClose();
        }}
      >
        <View className="w-24 h-24 rounded-2xl bg-gray-100 items-center justify-center overflow-hidden">
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <Text className="text-gray-400 font-semibold text-lg">{item.name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View className="flex-1 justify-center">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
            {item.name}
          </Text>
          {item.barcode ? <Text className="text-xs text-gray-500 mt-1">Barcode: {item.barcode}</Text> : null}
          {item.description ? (
            <Text className="text-xs text-gray-400 mt-1" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
        {alreadyAdded ? (
          <View className="self-start bg-green-50 px-2 py-1 rounded-lg">
            <Text className="text-[10px] font-semibold text-green-600">Already Added</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="px-6 pt-6 pb-3 border-b border-gray-100">
          <Text className="text-xl font-semibold text-gray-900">Choose from Template</Text>
          <Text className="text-xs text-gray-500 mt-2">Search the shared catalog to quickly add items to your shop.</Text>
        </View>
        <View className="px-6 pt-4 pb-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or barcode"
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
            autoFocus
          />
        </View>
        <View className="flex-1 px-6 pb-6">
          {isLoading ? (
            <InventoryTemplateItemSkeleton />
          ) : (
            <FlashList
              data={orderedTemplates}
              keyExtractor={(item) => item.id}
              estimatedItemSize={110}
              ItemSeparatorComponent={() => <View className="h-3" />}
              renderItem={renderItem}
              ListEmptyComponent={() => (
                <View className="flex-1 items-center justify-center py-20">
                  <Text className="text-sm text-gray-500">No templates found. Adjust your search.</Text>
                </View>
              )}
            />
          )}
        </View>
        <View className="px-6 py-4 border-t border-gray-100">
          <TouchableOpacity
            className="h-12 rounded-xl border border-gray-200 items-center justify-center"
            onPress={onClose}
          >
            <Text className="text-sm font-semibold text-gray-600">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}


