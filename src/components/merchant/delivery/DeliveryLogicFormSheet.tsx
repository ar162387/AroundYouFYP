import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Pressable, Dimensions } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
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
            <Text className="text-xl font-semibold text-gray-900">Delivery Logic Settings</Text>
            <Text className="text-xs text-gray-500 mt-2">
              Configure order value thresholds and surcharges for your shop.
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
              <Text className="text-sm font-semibold text-gray-700">Minimum Order Value (PKR)</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Orders below this value will have a surcharge applied. Default: 200 PKR
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
                      placeholder="200.00"
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
              <Text className="text-sm font-semibold text-gray-700">Small Order Surcharge (PKR)</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Additional fee for orders below the minimum value. Default: 40 PKR
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
                      placeholder="40.00"
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
              <Text className="text-sm font-semibold text-gray-700">Least Order Value - Hard Floor (PKR)</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Absolute minimum order value. Orders below this will be rejected at checkout. Default: 100 PKR
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
                      placeholder="100.00"
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
              <Text className="text-sm font-semibold text-gray-700 mb-2">🎉 Free Delivery Discount</Text>
              <Text className="text-xs text-gray-500 mb-4">
                Offer free delivery when order value and distance meet these criteria.
              </Text>

              {/* Free Delivery Threshold */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700">Order Value Threshold (PKR)</Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Minimum order value to qualify for free delivery. Default: 800 PKR
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
                        placeholder="800.00"
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
                <Text className="text-sm font-semibold text-gray-700">Maximum Distance (meters)</Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Maximum delivery distance for free delivery eligibility. Default: 1000m
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
                        placeholder="1000"
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
              <Text className="text-xs font-semibold text-blue-900 mb-2">How it works:</Text>
              <Text className="text-xs text-blue-700 mb-1">
                • Orders ≥ {watchedValues.minimumOrderValue || '200'} PKR: No surcharge
              </Text>
              <Text className="text-xs text-blue-700 mb-1">
                • Orders &lt; {watchedValues.minimumOrderValue || '200'} PKR: Add {watchedValues.smallOrderSurcharge || '40'} PKR surcharge
              </Text>
              <Text className="text-xs text-blue-700 mb-1">
                • Orders &lt; {watchedValues.leastOrderValue || '100'} PKR: Rejected at checkout
              </Text>
              <View className="mt-2 pt-2 border-t border-blue-200">
                <Text className="text-xs font-semibold text-emerald-700 mb-1">Free Delivery:</Text>
                <Text className="text-xs text-emerald-700">
                  Order value ≥ Rs {watchedValues.freeDeliveryThreshold || '800'} and distance ≤ {watchedValues.freeDeliveryRadius || '1000'}m
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
                <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
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
                  <Text className="text-sm font-semibold text-white">Save Settings</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

