import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Switch } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InventoryItem, InventoryTemplateItem } from '../../../types/inventory';

const centsRegex = /^\d+(\.\d{0,2})?$/;

const baseSchema = z.object({
  templateId: z.string().uuid().optional().nullable(),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be under 100 characters'),
  description: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(32, 'SKU must be under 32 characters'),
  priceDisplay: z
    .string()
    .min(1, 'Price is required')
    .regex(centsRegex, 'Enter a valid price'),
  isActive: z.boolean(),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
});

type InventoryItemFormState = z.infer<typeof baseSchema>;

export type InventoryItemFormValues = InventoryItemFormState & { priceCents: number };

type CategoryOption = {
  id: string;
  name: string;
};

type InventoryItemFormSheetProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  template?: InventoryTemplateItem | null;
  defaultItem?: InventoryItem | null;
  categoryOptions: CategoryOption[];
  loading?: boolean;
  deleteLoading?: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryItemFormValues) => void;
  onDelete?: () => void;
};

export function InventoryItemFormSheet({
  visible,
  mode,
  template,
  defaultItem,
  categoryOptions,
  loading,
  deleteLoading,
  onClose,
  onSubmit,
  onDelete,
}: InventoryItemFormSheetProps) {
  const defaultValues = useMemo(() => {
    if (defaultItem) {
      return {
        templateId: defaultItem.templateId ?? null,
        name: defaultItem.name,
        description: defaultItem.description ?? '',
        barcode: defaultItem.barcode ?? '',
        sku: defaultItem.sku,
        priceDisplay: (defaultItem.priceCents / 100).toFixed(2),
        isActive: defaultItem.isActive,
        categoryIds: defaultItem.categories.map((c) => c.id),
      };
    }
    if (template) {
      return {
        templateId: template.id,
        name: template.name,
        description: template.description ?? '',
        barcode: template.barcode ?? '',
        sku: '',
        priceDisplay: '',
        isActive: true,
        categoryIds: [],
      };
    }
    return {
      templateId: null,
      name: '',
      description: '',
      barcode: '',
      sku: '',
      priceDisplay: '',
      isActive: true,
      categoryIds: [] as string[],
    };
  }, [defaultItem, template]);

  const { control, handleSubmit, reset, watch, setValue, formState } = useForm<InventoryItemFormState>({
    resolver: zodResolver(baseSchema),
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (visible) {
      reset(defaultValues);
    }
  }, [visible, reset, defaultValues]);

  const templateLocked = Boolean(template) || Boolean(defaultItem?.templateId);

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View className="px-6 pt-6 pb-3 border-b border-gray-100">
          <Text className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add Inventory Item' : 'Edit Inventory Item'}
          </Text>
          {templateLocked ? (
            <Text className="text-xs text-gray-500 mt-2">
              This item inherits name and barcode from the shared catalog. Adjust SKU, price, and categories for your shop.
            </Text>
          ) : null}
        </View>
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="mt-6">
                <Text className="text-sm font-semibold text-gray-700">Name</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={`mt-2 border rounded-xl px-4 py-3 text-base ${templateLocked ? 'bg-gray-100 border-gray-100 text-gray-500' : 'border-gray-200 bg-white text-gray-900'}`}
                  editable={!templateLocked}
                  placeholder="Item name"
                />
                {fieldState.error ? (
                  <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="barcode"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="mt-5">
                <Text className="text-sm font-semibold text-gray-700">Barcode</Text>
                <TextInput
                  value={value ?? ''}
                  onChangeText={onChange}
                  className={`mt-2 border rounded-xl px-4 py-3 text-base ${templateLocked ? 'bg-gray-100 border-gray-100 text-gray-500' : 'border-gray-200 bg-white text-gray-900'}`}
                  editable={!templateLocked}
                  placeholder="Scan or enter"
                />
                {fieldState.error ? (
                  <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="sku"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="mt-5">
                <Text className="text-sm font-semibold text-gray-700">SKU</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder="Unique identifier"
                />
                {fieldState.error ? (
                  <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="priceDisplay"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="mt-5">
                <Text className="text-sm font-semibold text-gray-700">Price</Text>
                <TextInput
                  value={value}
                  onChangeText={(text) => {
                    if (text === '' || centsRegex.test(text)) {
                      onChange(text);
                    }
                  }}
                  keyboardType="decimal-pad"
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder="0.00"
                />
                {fieldState.error ? (
                  <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
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
                  multiline
                  numberOfLines={3}
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder="Optional notes for staff"
                  textAlignVertical="top"
                />
              </View>
            )}
          />

          <View className="mt-5">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Categories</Text>
            {categoryOptions.length === 0 ? (
              <View className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <Text className="text-xs text-amber-600">
                  Create a category first so you can assign this item. Close this form and add a category from the Categories tab.
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap">
                {categoryOptions.map((option) => {
                  const selected = watch('categoryIds').includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => {
                        const current = watch('categoryIds');
                        if (selected) {
                          setValue(
                            'categoryIds',
                            current.filter((id) => id !== option.id),
                            { shouldDirty: true }
                          );
                        } else {
                          setValue('categoryIds', [...current, option.id], { shouldDirty: true });
                        }
                      }}
                      className={`px-3 py-2 rounded-xl mr-2 mb-2 border ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                    >
                      <Text className={`text-xs font-semibold ${selected ? 'text-blue-600' : 'text-gray-600'}`}>
                        {option.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {formState.errors.categoryIds ? (
              <Text className="text-xs text-red-500 mt-1">{formState.errors.categoryIds.message}</Text>
            ) : null}
          </View>

          <Controller
            control={control}
            name="isActive"
            render={({ field: { value, onChange } }) => (
              <View className="mt-6 flex-row justify-between items-center">
                <View>
                  <Text className="text-sm font-semibold text-gray-700">Activate item</Text>
                  <Text className="text-xs text-gray-500 mt-1">Hidden items remain unavailable to shoppers.</Text>
                </View>
                <Switch value={value} onValueChange={onChange} />
              </View>
            )}
          />
        </ScrollView>

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
                onSubmit({ ...values, priceCents: Math.round(parseFloat(values.priceDisplay) * 100) });
              })}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  {mode === 'create' ? 'Save item' : 'Update item'}
                </Text>
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
                <Text className="text-sm font-semibold text-red-600">Delete item</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}


