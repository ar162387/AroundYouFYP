import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Pressable, Dimensions } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { DeliveryRunner } from '../../../services/merchant/deliveryRunnerService';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.55); // 55% of screen height

const phoneRegex = /^[\d\s\-\+\(\)]+$/;

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be under 100 characters'),
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .regex(phoneRegex, 'Enter a valid phone number')
    .max(20, 'Phone number must be under 20 characters'),
});

type DeliveryRunnerFormState = z.infer<typeof schema>;

type DeliveryRunnerFormSheetProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  defaultRunner?: DeliveryRunner | null;
  loading?: boolean;
  deleteLoading?: boolean;
  onClose: () => void;
  onSubmit: (values: DeliveryRunnerFormState) => void;
  onDelete?: () => void;
};

export function DeliveryRunnerFormSheet({
  visible,
  mode,
  defaultRunner,
  loading,
  deleteLoading,
  onClose,
  onSubmit,
  onDelete,
}: DeliveryRunnerFormSheetProps) {
  const { t } = useTranslation();
  const defaultValues = useMemo(() => {
    if (defaultRunner) {
      return {
        name: defaultRunner.name,
        phoneNumber: defaultRunner.phoneNumber,
      };
    }
    return {
      name: '',
      phoneNumber: '',
    };
  }, [defaultRunner]);

  const { control, handleSubmit, reset, formState } = useForm<DeliveryRunnerFormState>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (visible) {
      reset(defaultValues);
    }
  }, [visible, reset, defaultValues]);

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl" style={{ height: SHEET_HEIGHT }}>
          {/* Grabber Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </View>

          <View className="px-6 pb-3 border-b border-gray-100">
            <Text className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? t('merchant.delivery.runnerForm.addTitle') : t('merchant.delivery.runnerForm.editTitle')}
            </Text>
            <Text className="text-xs text-gray-500 mt-2">
              {t('merchant.delivery.runnerForm.description')}
            </Text>
          </View>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="mt-6">
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.runnerForm.name')}</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                  placeholder={t('merchant.delivery.runnerForm.namePlaceholder')}
                  autoCapitalize="words"
                />
                {fieldState.error ? (
                  <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { value, onChange }, fieldState }) => (
              <View className="mt-5">
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.runnerForm.phoneNumber')}</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  keyboardType="phone-pad"
                  className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                  placeholder={t('merchant.delivery.runnerForm.phoneNumberPlaceholder')}
                />
                {fieldState.error ? (
                  <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                ) : null}
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
                <Text className="text-sm font-semibold text-gray-600">{t('merchant.delivery.runnerForm.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center"
                onPress={handleSubmit(onSubmit)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-semibold text-white">
                    {mode === 'create' ? t('merchant.delivery.runnerForm.addRunner') : t('merchant.delivery.runnerForm.updateRunner')}
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
                  <Text className="text-sm font-semibold text-red-600">{t('merchant.delivery.runnerForm.deleteRunner')}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

