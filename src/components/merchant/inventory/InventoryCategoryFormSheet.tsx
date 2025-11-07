import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InventoryCategory, InventoryTemplateCategory } from '../../../types/inventory';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(60, 'Keep category names under 60 characters'),
  description: z.string().max(160, 'Keep descriptions short').optional().nullable(),
});

export type InventoryCategoryFormValues = z.infer<typeof schema>;
export type InventoryCategoryFormSubmit = InventoryCategoryFormValues & { templateId?: string | null };

type InventoryCategoryFormSheetProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  defaultCategory?: InventoryCategory | null;
  loading?: boolean;
  deleteLoading?: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryCategoryFormSubmit) => void;
  templateCategories?: InventoryTemplateCategory[];
  existingCategoryTemplateIds?: Set<string>;
  onDelete?: () => void;
};

export function InventoryCategoryFormSheet({
  visible,
  mode,
  defaultCategory,
  loading,
  deleteLoading,
  onClose,
  onSubmit,
  templateCategories,
  existingCategoryTemplateIds,
  onDelete,
}: InventoryCategoryFormSheetProps) {
  const defaultValues = useMemo(() => ({
    name: defaultCategory?.name ?? '',
    description: defaultCategory?.description ?? '',
  }), [defaultCategory]);

  const { control, handleSubmit, reset, formState, setValue } = useForm<InventoryCategoryFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(defaultCategory?.templateId ?? null);
  const isEditMode = mode === 'edit';
  const existingTemplateIdsSet = useMemo(
    () => existingCategoryTemplateIds ?? new Set<string>(),
    [existingCategoryTemplateIds]
  );
  const orderedTemplateCategories = useMemo(() => {
    if (!templateCategories || templateCategories.length === 0) {
      return [];
    }
    const available: InventoryTemplateCategory[] = [];
    const already: InventoryTemplateCategory[] = [];
    templateCategories.forEach((template) => {
      if (existingTemplateIdsSet.has(template.id)) {
        already.push(template);
      } else {
        available.push(template);
      }
    });
    return [...available, ...already];
  }, [templateCategories, existingTemplateIdsSet]);

  const groupedTemplateCategories = useMemo(() => {
    if (orderedTemplateCategories.length === 0) {
      return [];
    }
    const groups: InventoryTemplateCategory[][] = [];
    for (let index = 0; index < orderedTemplateCategories.length; index += 3) {
      groups.push(orderedTemplateCategories.slice(index, index + 3));
    }
    return groups;
  }, [orderedTemplateCategories]);

  useEffect(() => {
    if (visible) {
      reset(defaultValues);
      setSelectedTemplateId(defaultCategory?.templateId ?? null);
    }
  }, [visible, defaultValues, reset, defaultCategory?.templateId]);

  const handleTemplateSelect = (template: InventoryTemplateCategory) => {
    if (isEditMode) {
      return;
    }

    if (selectedTemplateId === template.id) {
      setSelectedTemplateId(null);
      setValue('name', '', { shouldDirty: true });
      setValue('description', '', { shouldDirty: true });
      return;
    }

    setSelectedTemplateId(template.id);
    setValue('name', template.name ?? '', { shouldDirty: true });
    setValue('description', template.description ?? '', { shouldDirty: true });
  };

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View className="px-6 pt-6 pb-3 border-b border-gray-100">
          <Text className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'New Category' : 'Edit Category'}
          </Text>
          <Text className="text-xs text-gray-500 mt-2">
            Categories help shoppers filter and staff batch updates quickly.
          </Text>
        </View>
        <View className="flex-1 px-6 pt-6">
          {groupedTemplateCategories.length > 0 ? (
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-700">Start from a template</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingVertical: 12 }}
              >
                {groupedTemplateCategories.map((group, columnIndex) => (
                  <View key={columnIndex} className="mr-4">
                    {group.map((template) => {
                      const selected = selectedTemplateId === template.id;
                      const alreadyAdded = existingTemplateIdsSet.has(template.id);
                      return (
                        <TouchableOpacity
                          key={template.id}
                          onPress={() => handleTemplateSelect(template)}
                          disabled={isEditMode || alreadyAdded}
                          className={`w-48 px-3 py-3 rounded-2xl border mb-3 ${
                            selected ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'
                          } ${alreadyAdded ? 'opacity-60 border-gray-200' : ''} ${isEditMode ? 'opacity-60' : ''}`}
                        >
                          <Text className={`text-sm font-semibold ${selected ? 'text-purple-600' : 'text-gray-700'}`}>
                            {template.name}
                          </Text>
                          {template.description ? (
                            <Text className="text-xs text-gray-500 mt-1" numberOfLines={2}>
                              {template.description}
                            </Text>
                          ) : null}
                          {alreadyAdded ? (
                            <View className="mt-3 self-start bg-green-50 border border-green-100 px-2 py-1 rounded-lg">
                              <Text className="text-[10px] font-semibold text-green-600">Already added</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
              {isEditMode && defaultCategory?.templateId ? (
                <Text className="text-xs text-gray-500 mt-2">
                  Linked to template: {templateCategories?.find((tpl) => tpl.id === defaultCategory.templateId)?.name || 'Shared template'}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <View>
                <Text className="text-sm font-semibold text-gray-700">Name</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="Produce"
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                />
                {formState.errors.name ? (
                  <Text className="text-xs text-red-500 mt-1">{formState.errors.name.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <View className="mt-5">
                <Text className="text-sm font-semibold text-gray-700">Description</Text>
                <TextInput
                  value={value ?? ''}
                  onChangeText={onChange}
                  placeholder="Visible to staff only"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                />
                {formState.errors.description ? (
                  <Text className="text-xs text-red-500 mt-1">{formState.errors.description.message}</Text>
                ) : null}
              </View>
            )}
          />
        </View>
        <View className="px-6 py-4 border-t border-gray-100 space-y-3">
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className="flex-1 h-12 rounded-xl border border-gray-200 items-center justify-center"
              onPress={onClose}
              disabled={loading || deleteLoading}
            >
              <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center"
              onPress={handleSubmit((values) => {
                if (loading || deleteLoading) {
                  return;
                }
                onSubmit({ ...values, templateId: selectedTemplateId });
              })}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold text-white">{mode === 'create' ? 'Save' : 'Update'}</Text>
              )}
            </TouchableOpacity>
          </View>
          {mode === 'edit' && onDelete ? (
            <TouchableOpacity
              className="h-12 rounded-xl border border-red-200 items-center justify-center"
              onPress={() => {
                if (loading || deleteLoading) {
                  return;
                }
                onDelete();
              }}
              disabled={loading || deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Text className="text-sm font-semibold text-red-600">Delete category</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}


