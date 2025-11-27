import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Pressable, Dimensions } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { DeliveryLogic } from '../../../services/merchant/deliveryLogicService';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.75); // 75% of screen height for more content (added free delivery)

const priceRegex = /^\d+(\.\d{0,2})?$/;

const schema = z.object({
  minimumOrderValue: z
    .string()
    .min(1, 'Minimum order value is required')
    .regex(priceRegex, 'Enter a valid amount')
    .refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  smallOrderSurcharge: z
    .string()
    .min(1, 'Small order surcharge is required')
    .regex(priceRegex, 'Enter a valid amount')
    .refine((val) => parseFloat(val) >= 0, 'Must be 0 or greater'),
  leastOrderValue: z
    .string()
    .min(1, 'Least order value is required')
    .regex(priceRegex, 'Enter a valid amount')
    .refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  freeDeliveryThreshold: z
    .string()
    .min(1, 'Free delivery threshold is required')
    .regex(priceRegex, 'Enter a valid amount'),
  freeDeliveryRadius: z
    .string()
    .min(1, 'Free delivery radius is required')
    .regex(/^\d+(\.\d+)?$/, 'Enter a valid number'),
}).refine(
  (data) => {
    const least = parseFloat(data.leastOrderValue);
    const minimum = parseFloat(data.minimumOrderValue);
    return least <= minimum;
  },
  {
    message: 'Least order value must be less than or equal to minimum order value',
    path: ['leastOrderValue'],
  }
);

type DeliveryLogicFormState = z.infer<typeof schema>;

type DeliveryLogicFormSheetProps = {
  visible: boolean;
  defaultLogic?: DeliveryLogic | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: {
    minimumOrderValue: number;
    smallOrderSurcharge: number;
    leastOrderValue: number;
    freeDeliveryThreshold: number;
    freeDeliveryRadius: number;
  }) => void;
};

export function DeliveryLogicFormSheet({
  visible,
  defaultLogic,
  loading,
  onClose,
  onSubmit,
}: DeliveryLogicFormSheetProps) {
  const { t } = useTranslation();
  const defaultValues = useMemo(() => {
    if (defaultLogic) {
      return {
        minimumOrderValue: defaultLogic.minimumOrderValue.toFixed(2),
        smallOrderSurcharge: defaultLogic.smallOrderSurcharge.toFixed(2),
        leastOrderValue: defaultLogic.leastOrderValue.toFixed(2),
        freeDeliveryThreshold: defaultLogic.freeDeliveryThreshold.toFixed(2),
        freeDeliveryRadius: defaultLogic.freeDeliveryRadius.toFixed(0),
      };
    }
    return {
      minimumOrderValue: '200.00',
      smallOrderSurcharge: '40.00',
      leastOrderValue: '100.00',
      freeDeliveryThreshold: '800.00',
      freeDeliveryRadius: '1000',
    };
  }, [defaultLogic]);

  const { control, handleSubmit, reset, formState, watch } = useForm<DeliveryLogicFormState>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  const watchedValues = watch();

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
            <Text className="text-xl font-semibold text-gray-900">{t('merchant.delivery.logicForm.title')}</Text>
            <Text className="text-xs text-gray-500 mt-2">
              {t('merchant.delivery.logicForm.description')}
            </Text>
          </View>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Minimum Order Value */}
            <View className="mt-6">
              <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.logicForm.minimumOrderValue')}</Text>
              <Text className="text-xs text-gray-500 mt-1">
                {t('merchant.delivery.logicForm.minimumOrderValueDesc')}
              </Text>
              <Controller
                control={control}
                name="minimumOrderValue"
                render={({ field: { value, onChange }, fieldState }) => (
                  <>
                    <TextInput
                      value={value}
                      onChangeText={(text) => {
                        if (text === '' || priceRegex.test(text)) {
                          onChange(text);
                        }
                      }}
                      keyboardType="decimal-pad"
                      className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                      placeholder={t('merchant.delivery.logicForm.minimumOrderValuePlaceholder')}
                    />
                    {fieldState.error ? (
                      <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                    ) : null}
                  </>
                )}
              />
            </View>

            {/* Small Order Surcharge */}
            <View className="mt-5">
              <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.logicForm.smallOrderSurcharge')}</Text>
              <Text className="text-xs text-gray-500 mt-1">
                {t('merchant.delivery.logicForm.smallOrderSurchargeDesc')}
              </Text>
              <Controller
                control={control}
                name="smallOrderSurcharge"
                render={({ field: { value, onChange }, fieldState }) => (
                  <>
                    <TextInput
                      value={value}
                      onChangeText={(text) => {
                        if (text === '' || priceRegex.test(text)) {
                          onChange(text);
                        }
                      }}
                      keyboardType="decimal-pad"
                      className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                      placeholder={t('merchant.delivery.logicForm.smallOrderSurchargePlaceholder')}
                    />
                    {fieldState.error ? (
                      <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                    ) : null}
                  </>
                )}
              />
            </View>

            {/* Least Order Value */}
            <View className="mt-5">
              <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.logicForm.leastOrderValue')}</Text>
              <Text className="text-xs text-gray-500 mt-1">
                {t('merchant.delivery.logicForm.leastOrderValueDesc')}
              </Text>
              <Controller
                control={control}
                name="leastOrderValue"
                render={({ field: { value, onChange }, fieldState }) => (
                  <>
                    <TextInput
                      value={value}
                      onChangeText={(text) => {
                        if (text === '' || priceRegex.test(text)) {
                          onChange(text);
                        }
                      }}
                      keyboardType="decimal-pad"
                      className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                      placeholder={t('merchant.delivery.logicForm.leastOrderValuePlaceholder')}
                    />
                    {fieldState.error ? (
                      <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                    ) : null}
                  </>
                )}
              />
            </View>

            {/* Free Delivery Discount Section */}
            <View className="mt-6 pt-6 border-t border-gray-100">
              <Text className="text-sm font-semibold text-gray-700 mb-2">🎉 {t('merchant.delivery.logicForm.freeDeliveryTitle')}</Text>
              <Text className="text-xs text-gray-500 mb-4">
                {t('merchant.delivery.logicForm.freeDeliveryDesc')}
              </Text>

              {/* Free Delivery Threshold */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.logicForm.freeDeliveryThreshold')}</Text>
                <Text className="text-xs text-gray-500 mt-1">
                  {t('merchant.delivery.logicForm.freeDeliveryThresholdDesc')}
                </Text>
                <Controller
                  control={control}
                  name="freeDeliveryThreshold"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <>
                      <TextInput
                        value={value}
                        onChangeText={(text) => {
                          if (text === '' || priceRegex.test(text)) {
                            onChange(text);
                          }
                        }}
                        keyboardType="decimal-pad"
                        className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                        placeholder={t('merchant.delivery.logicForm.freeDeliveryThresholdPlaceholder')}
                      />
                      {fieldState.error ? (
                        <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                      ) : null}
                    </>
                  )}
                />
              </View>

              {/* Free Delivery Radius */}
              <View>
                <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.logicForm.freeDeliveryRadius')}</Text>
                <Text className="text-xs text-gray-500 mt-1">
                  {t('merchant.delivery.logicForm.freeDeliveryRadiusDesc')}
                </Text>
                <Controller
                  control={control}
                  name="freeDeliveryRadius"
                  render={({ field: { value, onChange }, fieldState }) => (
                    <>
                      <TextInput
                        value={value}
                        onChangeText={(text) => {
                          if (text === '' || /^\d+$/.test(text)) {
                            onChange(text);
                          }
                        }}
                        keyboardType="number-pad"
                        className="mt-2 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                        placeholder={t('merchant.delivery.logicForm.freeDeliveryRadiusPlaceholder')}
                      />
                      {fieldState.error ? (
                        <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                      ) : null}
                    </>
                  )}
                />
              </View>
            </View>

            {/* Info Box */}
            <View className="mt-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Text className="text-xs font-semibold text-blue-900 mb-2">{t('merchant.delivery.logicForm.howItWorks')}</Text>
              <Text className="text-xs text-blue-700 mb-1">
                • {t('merchant.delivery.logicForm.noSurcharge', { amount: watchedValues.minimumOrderValue || '200' })}
              </Text>
              <Text className="text-xs text-blue-700 mb-1">
                • {t('merchant.delivery.logicForm.addSurcharge', { amount: watchedValues.minimumOrderValue || '200', surcharge: watchedValues.smallOrderSurcharge || '40' })}
              </Text>
              <Text className="text-xs text-blue-700 mb-1">
                • {t('merchant.delivery.logicForm.rejected', { amount: watchedValues.leastOrderValue || '100' })}
              </Text>
              <View className="mt-2 pt-2 border-t border-blue-200">
                <Text className="text-xs font-semibold text-emerald-700 mb-1">{t('merchant.delivery.logicForm.freeDeliveryLabel')}</Text>
                <Text className="text-xs text-emerald-700">
                  {t('merchant.delivery.logicForm.freeDeliveryCondition', { threshold: watchedValues.freeDeliveryThreshold || '800', radius: watchedValues.freeDeliveryRadius || '1000' })}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View className="px-6 py-4 border-t border-gray-100">
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl border border-gray-200 items-center justify-center"
                onPress={onClose}
                disabled={loading}
              >
                <Text className="text-sm font-semibold text-gray-600">{t('merchant.delivery.logicForm.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center"
                onPress={handleSubmit((values) => {
                  onSubmit({
                    minimumOrderValue: parseFloat(values.minimumOrderValue),
                    smallOrderSurcharge: parseFloat(values.smallOrderSurcharge),
                    leastOrderValue: parseFloat(values.leastOrderValue),
                    freeDeliveryThreshold: parseFloat(values.freeDeliveryThreshold),
                    freeDeliveryRadius: parseFloat(values.freeDeliveryRadius),
                  });
                })}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-semibold text-white">{t('merchant.delivery.logicForm.saveSettings')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

