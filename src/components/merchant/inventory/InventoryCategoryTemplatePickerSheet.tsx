import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { InventoryTemplateCategory } from '../../../types/inventory';
import InventoryTemplateCategorySkeleton from '../../../skeleton/InventoryTemplateCategorySkeleton';

type InventoryCategoryTemplatePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  templateCategories: InventoryTemplateCategory[];
  onSelect: (template: InventoryTemplateCategory) => void;
  existingCategoryTemplateIds: Set<string>;
  loading?: boolean;
};

export function InventoryCategoryTemplatePickerSheet({
  visible,
  onClose,
  templateCategories,
  onSelect,
  existingCategoryTemplateIds,
  loading = false,
}: InventoryCategoryTemplatePickerSheetProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearch('');
    }
  }, [visible]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) {
      return templateCategories;
    }
    const lower = search.toLowerCase();
    return templateCategories.filter((category) =>
      category.name.toLowerCase().includes(lower) || (category.description ?? '').toLowerCase().includes(lower)
    );
  }, [templateCategories, search]);

  const orderedCategories = useMemo(() => {
    const available: InventoryTemplateCategory[] = [];
    const already: InventoryTemplateCategory[] = [];
    filteredCategories.forEach((category) => {
      if (existingCategoryTemplateIds.has(category.id)) {
        already.push(category);
      } else {
        available.push(category);
      }
    });
    return [...available, ...already];
  }, [filteredCategories, existingCategoryTemplateIds]);

  const renderItem = ({ item }: { item: InventoryTemplateCategory }) => {
    const alreadyAdded = existingCategoryTemplateIds.has(item.id);

    return (
      <TouchableOpacity
        className="bg-white border border-gray-100 rounded-3xl p-4"
        onPress={() => {
          if (alreadyAdded) {
            Alert.alert('Already Added', 'This category is already available in your shop.');
            return;
          }
          onSelect(item);
        }}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-4">
            <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
            {item.description ? <Text className="text-xs text-gray-500 mt-1">{item.description}</Text> : null}
          </View>
          {alreadyAdded ? (
            <View className="bg-green-50 px-2 py-1 rounded-lg">
              <Text className="text-[10px] font-semibold text-green-600">Already Added</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="px-6 pt-6 pb-3 border-b border-gray-100">
          <Text className="text-xl font-semibold text-gray-900">Choose Category Template</Text>
          <Text className="text-xs text-gray-500 mt-2">
            Browse built-in categories and add them to your shop with a tap.
          </Text>
        </View>
        <View className="px-6 pt-4 pb-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search categories"
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
            autoFocus
          />
        </View>
        <View className="flex-1 px-6 pb-6">
          {loading ? (
            <InventoryTemplateCategorySkeleton />
          ) : (
            <FlashList
              data={orderedCategories}
              keyExtractor={(item) => item.id}
              estimatedItemSize={90}
              ItemSeparatorComponent={() => <View className="h-3" />}
              renderItem={renderItem}
              ListEmptyComponent={() => (
                <View className="flex-1 items-center justify-center py-20">
                  <Text className="text-sm text-gray-500">No categories match your search.</Text>
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


