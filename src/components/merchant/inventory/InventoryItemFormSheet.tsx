import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InventoryItem, InventoryTemplateItem } from '../../../types/inventory';
import { useTranslation } from 'react-i18next';
import { uploadItemImage } from '../../../services/merchant/shopService';
import { useAuth } from '../../../context/AuthContext';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import Svg, { Path, Rect } from 'react-native-svg';

const centsRegex = /^\d+(\.\d{0,2})?$/;

type InventoryItemFormState = {
  templateId?: string | null;
  name: string;
  description?: string | null;
  barcode?: string | null;
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
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const cameraDevice = useCameraDevice('back');

  const schema = useMemo(() => z.object({
    templateId: z.string().uuid().optional().nullable(),
    name: z
      .string()
      .min(1, t('merchant.inventory.form.required'))
      .max(100, 'Name must be under 100 characters'),
    description: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
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
      // Template create: catalog image lives on `template`, not `defaultItem`
      setImageUri(defaultItem?.imageUrl ?? template?.imageUrl ?? null);
    }
  }, [visible, reset, defaultValues, defaultItem, template]);

  const templateLocked = Boolean(template) || Boolean(defaultItem?.templateId);
  const isCustomItem = !templateLocked; // Only allow image upload for custom items
  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39', 'qr'],
    onCodeScanned: (codes) => {
      if (!scannerVisible || isScanningBarcode) {
        return;
      }

      const scannedValue = codes[0]?.value?.trim();
      if (!scannedValue) {
        return;
      }

      setIsScanningBarcode(true);
      setValue('barcode', scannedValue, { shouldDirty: true, shouldValidate: true });
      setScannerVisible(false);
      setTimeout(() => setIsScanningBarcode(false), 700);
    },
  });

  const handleOpenBarcodeScanner = async () => {
    try {
      const currentPermission = await Camera.getCameraPermissionStatus();
      if (currentPermission === 'granted') {
        setCameraPermissionGranted(true);
        setScannerVisible(true);
        return;
      }

      const nextPermission = await Camera.requestCameraPermission();
      const granted = nextPermission === 'granted';
      setCameraPermissionGranted(granted);

      if (!granted) {
        Alert.alert(
          'Camera permission needed',
          'Allow camera access to scan product barcodes.'
        );
        return;
      }

      setScannerVisible(true);
    } catch (error: any) {
      Alert.alert('Scanner Error', error?.message || 'Unable to open barcode scanner.');
    }
  };

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
              This item inherits name and barcode from the shared catalog. Adjust price and categories for your shop.
            </Text>
          ) : null}
        </View>
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image: upload for custom items; read-only preview for catalog/template items */}
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
                    <CameraIcon size={28} color="#9CA3AF" />
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
          ) : imageUri ? (
            <View className="mt-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                {t('merchant.inventory.form.catalogImage', { defaultValue: 'Catalog image' })}
              </Text>
              <View className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden border border-gray-200">
                <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
              </View>
              <Text className="text-xs text-gray-500 mt-2">
                {t('merchant.inventory.form.catalogImageHint', {
                  defaultValue:
                    'This photo comes from the shared catalog and is shown to customers for this item.',
                })}
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
                <View className="mt-2 relative justify-center">
                  <TextInput
                    value={value ?? ''}
                    onChangeText={onChange}
                    className={`border rounded-xl px-4 py-3 text-base ${templateLocked ? 'bg-gray-100 border-gray-100 text-gray-500 pr-4' : 'border-gray-200 bg-white text-gray-900 pr-14'}`}
                    editable={!templateLocked}
                    placeholder={t('merchant.inventory.form.enterBarcode')}
                  />
                  {!templateLocked ? (
                    <TouchableOpacity
                      onPress={handleOpenBarcodeScanner}
                      className="absolute right-3 h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel="Scan barcode using camera"
                    >
                      <CameraIcon size={18} color="#2563EB" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {!templateLocked ? (
                  <Text className="text-xs text-gray-500 mt-1">Tap the camera icon to scan barcode automatically.</Text>
                ) : null}
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
                    } else if (
                      imageUri.startsWith('http://') ||
                      imageUri.startsWith('https://') ||
                      imageUri.startsWith('/uploads/')
                    ) {
                      // Keep existing image URL (no change)
                      finalImageUrl = imageUri;
                    }
                  } else {
                    // Image was removed - set to null to clear it
                    finalImageUrl = null;
                  }
                } else {
                  // Template / catalog item: backend never copies template image automatically — send catalog URL
                  const remote =
                    imageUri &&
                    (imageUri.startsWith('http://') ||
                      imageUri.startsWith('https://') ||
                      imageUri.startsWith('/uploads/'))
                      ? imageUri
                      : null;
                  finalImageUrl = remote ?? template?.imageUrl ?? defaultItem?.imageUrl ?? null;
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
      <Modal
        visible={scannerVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerRoot}>
          {cameraPermissionGranted && cameraDevice ? (
            <Camera
              style={StyleSheet.absoluteFill}
              device={cameraDevice}
              isActive={scannerVisible}
              codeScanner={codeScanner}
            />
          ) : (
            <View style={styles.centerFallback}>
              <Text style={styles.fallbackTitle}>Camera unavailable</Text>
              <Text style={styles.fallbackText}>Check camera permission and try again.</Text>
            </View>
          )}

          <View style={styles.overlay}>
            <View style={styles.overlayTop}>
              <Text style={styles.overlayTitle}>Scan Product Barcode</Text>
              <Text style={styles.overlaySubtitle}>Place the barcode inside the frame.</Text>
            </View>
            <View style={styles.overlayMiddleRow}>
              <View style={styles.overlaySide} />
              <View style={styles.scanFrame} />
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom} />
          </View>

          <TouchableOpacity
            onPress={() => setScannerVisible(false)}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close barcode scanner"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Modal>
  );
}

function CameraIcon({ size = 20, color = '#2563EB' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.75" y="7.75" width="16.5" height="12.5" rx="2.25" stroke={color} strokeWidth="1.5" />
      <Path d="M9.25 7.75L10.3 5.95C10.6 5.45 11.12 5.15 11.7 5.15H12.3C12.88 5.15 13.4 5.45 13.7 5.95L14.75 7.75" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M12 16.5C13.52 16.5 14.75 15.27 14.75 13.75C14.75 12.23 13.52 11 12 11C10.48 11 9.25 12.23 9.25 13.75C9.25 15.27 10.48 16.5 12 16.5Z" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scannerRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  fallbackText: {
    marginTop: 8,
    color: '#CBD5E1',
    fontSize: 14,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  overlayMiddleRow: {
    height: 240,
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scanFrame: {
    width: 280,
    borderWidth: 2,
    borderColor: '#22D3EE',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  overlaySubtitle: {
    color: '#E2E8F0',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});


