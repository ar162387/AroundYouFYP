import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { InventoryCategory, InventoryListParams } from '../../../types/inventory';

type InventoryFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: InventoryListParams) => void;
  selectedFilters: InventoryListParams;
  categories: InventoryCategory[];
};

const statusOptions: Array<{ label: string; value: InventoryListParams['active'] }> = [
  { label: 'All', value: null },
  { label: 'Active', value: true },
  { label: 'Hidden', value: false },
];

const templateOptions: Array<{ label: string; value: InventoryListParams['templateFilter'] }> = [
  { label: 'All', value: 'all' },
  { label: 'Templates', value: 'template' },
  { label: 'Custom only', value: 'custom' },
];

export function InventoryFilterSheet({
  visible,
  onClose,
  onApply,
  selectedFilters,
  categories,
}: InventoryFilterSheetProps) {
  const [draftFilters, setDraftFilters] = React.useState<InventoryListParams>(selectedFilters);

  React.useEffect(() => {
    if (visible) {
      setDraftFilters(selectedFilters);
    }
  }, [visible, selectedFilters]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="px-6 pt-6 pb-3 border-b border-gray-100">
          <Text className="text-xl font-semibold text-gray-900">Filters</Text>
        </View>
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="mt-6">
            <Text className="text-sm font-semibold text-gray-700">Status</Text>
            <View className="flex-row flex-wrap mt-3">
              {statusOptions.map((option) => {
                const selected = draftFilters.active === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, active: option.value }))}
                    className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-blue-600' : 'text-gray-600'}`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-sm font-semibold text-gray-700">Type</Text>
            <View className="flex-row flex-wrap mt-3">
              {templateOptions.map((option) => {
                const selected = draftFilters.templateFilter === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, templateFilter: option.value }))}
                    className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${selected ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-purple-600' : 'text-gray-600'}`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-sm font-semibold text-gray-700">Categories</Text>
            <View className="flex-row flex-wrap mt-3">
              {categories.map((category) => {
                const selected = draftFilters.categoryIds?.includes(category.id) ?? false;
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => {
                      setDraftFilters((prev) => {
                        const current = prev.categoryIds ?? [];
                        if (selected) {
                          return { ...prev, categoryIds: current.filter((id) => id !== category.id) };
                        }
                        return { ...prev, categoryIds: [...current, category.id] };
                      });
                    }}
                    className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-blue-600' : 'text-gray-600'}`}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <View className="px-6 py-4 border-t border-gray-100 flex-row space-x-3">
          <TouchableOpacity
            className="flex-1 h-12 rounded-xl border border-gray-200 items-center justify-center"
            onPress={() => {
              setDraftFilters({ active: null, templateFilter: 'all', categoryIds: [] });
            }}
          >
            <Text className="text-sm font-semibold text-gray-600">Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center"
            onPress={() => onApply(draftFilters)}
          >
            <Text className="text-sm font-semibold text-white">Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}


