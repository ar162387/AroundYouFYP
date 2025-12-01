import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Switch, Image, Alert } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InventoryItem, InventoryTemplateItem } from '../../../types/inventory';
import { useTranslation } from 'react-i18next';
import { uploadItemImage } from '../../../services/merchant/shopService';
import { useAuth } from '../../../context/AuthContext';

const centsRegex = /^\d+(\.\d{0,2})?$/;

type InventoryItemFormState = {
  templateId?: string | null;
  name: string;
  description?: string | null;
  barcode?: string | null;
  sku: string;
  priceDisplay: string;
  isActive: boolean;
  categoryIds: string[];
};

export type InventoryItemFormValues = InventoryItemFormState & { priceCents: number; imageUrl?: string | null };

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(defaultItem?.imageUrl || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const schema = useMemo(() => z.object({
    templateId: z.string().uuid().optional().nullable(),
    name: z
      .string()
      .min(1, t('merchant.inventory.form.required'))
      .max(100, 'Name must be under 100 characters'),
    description: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    sku: z
      .string()
      .min(1, t('merchant.inventory.form.required'))
      .max(32, 'SKU must be under 32 characters'),
    priceDisplay: z
      .string()
      .min(1, t('merchant.inventory.form.required'))
      .regex(centsRegex, 'Enter a valid price'),
    isActive: z.boolean(),
    categoryIds: z.array(z.string()).min(1, t('merchant.inventory.form.required')),
  }), [t]);

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
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (visible) {
      reset(defaultValues);
      setImageUri(defaultItem?.imageUrl || null);
    }
  }, [visible, reset, defaultValues, defaultItem]);

  const templateLocked = Boolean(template) || Boolean(defaultItem?.templateId);
  const isCustomItem = !templateLocked; // Only allow image upload for custom items

  // Image picker handler with 1:1 aspect ratio crop
  const handlePickImage = async () => {
    try {
      const ImageCropPicker = require('react-native-image-crop-picker');
      
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        width: 800,
        height: 800, // 1:1 aspect ratio for item images
        cropping: true,
        cropperToolbarTitle: 'Adjust Image',
        cropperChooseText: 'Choose',
        cropperCancelText: 'Cancel',
        cropperRotateButtonsHidden: false,
        freeStyleCropEnabled: false,
        aspectRatio: [1, 1], // 1:1 aspect ratio
        compressImageQuality: 0.8,
        includeBase64: false,
      });

      setImageUri(image.path);
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        Alert.alert('Error', error.message || 'Failed to pick image');
      }
    }
  };

  // Edit existing image
  const handleEditImage = async () => {
    if (!imageUri || imageUri.startsWith('http')) {
      // Can't edit remote images, just pick a new one
      handlePickImage();
      return;
    }

    try {
      const ImageCropPicker = require('react-native-image-crop-picker');
      
      const image = await ImageCropPicker.openCropper({
        path: imageUri,
        width: 800,
        height: 800, // 1:1 aspect ratio
        cropping: true,
        cropperToolbarTitle: 'Adjust Image',
        cropperChooseText: 'Save',
        cropperCancelText: 'Cancel',
        cropperRotateButtonsHidden: false,
        freeStyleCropEnabled: false,
        aspectRatio: [1, 1],
        compressImageQuality: 0.8,
        includeBase64: false,
      });

      setImageUri(image.path);
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        Alert.alert('Error', error.message || 'Failed to edit image');
      }
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    setImageUri(null);
  };

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View className="px-6 pt-6 pb-3 border-b border-gray-100">
          <Text className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? t('merchant.inventory.form.createItem') : t('merchant.inventory.form.editItem')}
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
          {/* Image Upload Section - Only for custom items */}
          {isCustomItem ? (
            <View className="mt-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('merchant.inventory.form.image') || 'Item Image'}</Text>
              <View className="flex-row items-center">
                {imageUri ? (
                  <View className="relative mr-4">
                    <Image
                      source={{ uri: imageUri }}
                      className="w-24 h-24 rounded-2xl"
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={handleRemoveImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                    >
                      <Text className="text-white text-xs font-bold">×</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 items-center justify-center mr-4">
                    <Text className="text-gray-400 text-2xl">📷</Text>
                  </View>
                )}
                <View className="flex-1">
                  <TouchableOpacity
                    onPress={imageUri ? handleEditImage : handlePickImage}
                    className="h-10 rounded-xl border border-gray-200 items-center justify-center bg-white mb-2"
                  >
                    <Text className="text-sm font-semibold text-gray-700">
                      {imageUri ? (t('merchant.inventory.form.changeImage') || 'Change Image') : (t('merchant.inventory.form.addImage') || 'Add Image')}
                    </Text>
                  </TouchableOpacity>
                  {imageUri ? (
                    <TouchableOpacity
                      onPress={handleRemoveImage}
                      className="h-10 rounded-xl border border-red-200 items-center justify-center bg-white"
                    >
                      <Text className="text-sm font-semibold text-red-600">
                        {t('merchant.inventory.form.removeImage') || 'Remove'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <Text className="text-xs text-gray-500 mt-2">
                {t('merchant.inventory.form.imageHint') || 'Upload a square image (1:1 ratio) for best results'}
              </Text>
            </View>
          ) : null}

          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="mt-6">
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.inventory.form.name')}</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className={`mt-2 border rounded-xl px-4 py-3 text-base ${templateLocked ? 'bg-gray-100 border-gray-100 text-gray-500' : 'border-gray-200 bg-white text-gray-900'}`}
                  editable={!templateLocked}
                  placeholder={t('merchant.inventory.form.enterName')}
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
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.inventory.form.barcode')}</Text>
                <TextInput
                  value={value ?? ''}
                  onChangeText={onChange}
                  className={`mt-2 border rounded-xl px-4 py-3 text-base ${templateLocked ? 'bg-gray-100 border-gray-100 text-gray-500' : 'border-gray-200 bg-white text-gray-900'}`}
                  editable={!templateLocked}
                  placeholder={t('merchant.inventory.form.enterBarcode')}
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
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.inventory.form.sku')}</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder={t('merchant.inventory.form.enterSku')}
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
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.inventory.form.price')}</Text>
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
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.inventory.form.description')}</Text>
                <TextInput
                  value={value ?? ''}
                  onChangeText={onChange}
                  multiline
                  numberOfLines={3}
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder={t('merchant.inventory.form.enterDescription')}
                  textAlignVertical="top"
                />
              </View>
            )}
          />

          <View className="mt-5">
            <Text className="text-sm font-semibold text-gray-700 mb-2">{t('merchant.inventory.tabs.categories')}</Text>
            {categoryOptions.length === 0 ? (
              <View className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <Text className="text-xs text-amber-600">
                  {t('merchant.inventory.common.createCategoryFirstDesc')}
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
                  <Text className="text-sm font-semibold text-gray-700">{t('merchant.inventory.form.active')}</Text>
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
              <Text className="text-sm font-semibold text-gray-600">{t('merchant.inventory.common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center"
              onPress={handleSubmit(async (values) => {
                if (loading || deleteLoading || isUploadingImage) {
                  return;
                }

                let finalImageUrl: string | null | undefined = undefined;

                // Handle image upload for custom items
                if (isCustomItem) {
                  if (imageUri) {
                    if (imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('ph://')) {
                      // New image selected - upload it
                      if (!user) {
                        Alert.alert('Error', 'Not authenticated. Please log in again.');
                        return;
                      }
                      setIsUploadingImage(true);
                      try {
                        const { url, error: uploadError } = await uploadItemImage(user.id, imageUri);
                        if (uploadError) {
                          Alert.alert('Upload Error', uploadError.message);
                          setIsUploadingImage(false);
                          return;
                        }
                        finalImageUrl = url || null;
                      } catch (error: any) {
                        Alert.alert('Upload Error', error.message || 'Failed to upload image');
                        setIsUploadingImage(false);
                        return;
                      } finally {
                        setIsUploadingImage(false);
                      }
                    } else if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
                      // Keep existing image URL (no change)
                      finalImageUrl = imageUri;
                    }
                  } else {
                    // Image was removed - set to null to clear it
                    finalImageUrl = null;
                  }
                }

                onSubmit({ 
                  ...values, 
                  priceCents: Math.round(parseFloat(values.priceDisplay) * 100),
                  imageUrl: finalImageUrl,
                });
              })}
              disabled={loading || isUploadingImage}
            >
              {loading || isUploadingImage ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  {mode === 'create' ? t('merchant.inventory.common.save') : t('merchant.inventory.common.save')}
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
                <Text className="text-sm font-semibold text-red-600">{t('merchant.inventory.items.deleteTitle')}</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}


