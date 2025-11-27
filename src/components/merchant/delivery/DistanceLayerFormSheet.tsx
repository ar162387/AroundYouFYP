import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Pressable, Dimensions, Switch } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { DeliveryLogic, DistanceTier } from '../../../services/merchant/deliveryLogicService';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.8); // 80% for more content

const priceRegex = /^\d+(\.\d{0,2})?$/;

const schema = z.object({
  maxDeliveryFee: z
    .string()
    .min(1, 'Max delivery fee is required')
    .regex(priceRegex, 'Enter a valid amount')
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num <= 300;
      },
      { message: 'Maximum delivery fee cannot exceed 300 PKR' }
    ),
  beyondTierFeePerUnit: z
    .string()
    .min(1, 'Fee per unit is required')
    .regex(priceRegex, 'Enter a valid amount'),
  beyondTierDistanceUnit: z
    .string()
    .min(1, 'Distance unit is required')
    .regex(/^\d+(\.\d+)?$/, 'Enter a valid distance'),
});

type DistanceLayerFormState = z.infer<typeof schema>;

type DistanceLayerFormSheetProps = {
  visible: boolean;
  defaultLogic?: DeliveryLogic | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: {
    distanceMode: 'auto' | 'custom';
    maxDeliveryFee: number;
    distanceTiers?: DistanceTier[];
    beyondTierFeePerUnit: number;
    beyondTierDistanceUnit: number;
  }) => void;
};

const DEFAULT_TIERS: DistanceTier[] = [
  { max_distance: 200, fee: 20 },
  { max_distance: 400, fee: 30 },
  { max_distance: 600, fee: 40 },
  { max_distance: 800, fee: 50 },
  { max_distance: 1000, fee: 60 },
];

export function DistanceLayerFormSheet({
  visible,
  defaultLogic,
  loading,
  onClose,
  onSubmit,
}: DistanceLayerFormSheetProps) {
  const { t } = useTranslation();
  const [distanceMode, setDistanceMode] = useState<'auto' | 'custom'>('auto');
  const [customTiers, setCustomTiers] = useState<DistanceTier[]>(DEFAULT_TIERS);
  const [tierInputs, setTierInputs] = useState<{ distance: string; fee: string }[]>(
    DEFAULT_TIERS.map(t => ({ distance: t.max_distance.toString(), fee: t.fee.toString() }))
  );
  const [validationErrors, setValidationErrors] = useState<{ [key: number]: { distance?: string; fee?: string } }>({});

  const defaultValues = useMemo(() => {
    if (defaultLogic) {
      return {
        maxDeliveryFee: defaultLogic.maxDeliveryFee.toFixed(2),
        beyondTierFeePerUnit: defaultLogic.beyondTierFeePerUnit.toFixed(2),
        beyondTierDistanceUnit: defaultLogic.beyondTierDistanceUnit.toFixed(0),
      };
    }
    return {
      maxDeliveryFee: '130.00',
      beyondTierFeePerUnit: '10.00',
      beyondTierDistanceUnit: '250',
    };
  }, [defaultLogic]);

  const { control, handleSubmit, reset, watch } = useForm<DistanceLayerFormState>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  const watchedValues = watch();

  useEffect(() => {
    if (visible) {
      reset(defaultValues);
      setDistanceMode(defaultLogic?.distanceMode || 'auto');
      const tiersToSet = defaultLogic?.distanceTiers && defaultLogic.distanceTiers.length > 0
        ? defaultLogic.distanceTiers
        : DEFAULT_TIERS;
      setCustomTiers(tiersToSet);
      setTierInputs(tiersToSet.map(t => ({
        distance: t.max_distance.toString(),
        fee: t.fee.toString()
      })));
      
      // Validate tiers with the max delivery fee after a short delay to ensure form is reset
      setTimeout(() => {
        const maxFee = defaultLogic?.maxDeliveryFee || parseFloat(defaultValues.maxDeliveryFee);
        if (defaultLogic?.distanceMode === 'custom' || !defaultLogic) {
          validateTiers(tiersToSet, maxFee);
        } else {
          setValidationErrors({});
        }
      }, 100);
    }
  }, [visible, reset, defaultValues, defaultLogic]);

  const validateTiers = (tiers: DistanceTier[], maxDeliveryFee?: number): boolean => {
    const errors: { [key: number]: { distance?: string; fee?: string } } = {};
    let isValid = true;

    tiers.forEach((tier, index) => {
      // Validate distance is greater than previous tier
      if (index > 0) {
        const prevTier = tiers[index - 1];
        if (tier.max_distance <= prevTier.max_distance) {
          errors[index] = {
            ...errors[index],
            distance: t('merchant.delivery.distanceForm.mustBeGreater'),
          };
          isValid = false;
        }
      }

      // Validate fee is >= previous tier
      if (index > 0) {
        const prevTier = tiers[index - 1];
        if (tier.fee < prevTier.fee) {
          errors[index] = {
            ...errors[index],
            fee: t('merchant.delivery.distanceForm.mustBeGreaterOrEqual'),
          };
          isValid = false;
        }
      }

      // Validate fee is not greater than max delivery fee
      if (maxDeliveryFee !== undefined && tier.fee > maxDeliveryFee) {
        errors[index] = {
          ...errors[index],
          fee: t('merchant.delivery.distanceForm.mustNotExceed', { amount: maxDeliveryFee }),
        };
        isValid = false;
      }

      // Basic validation
      if (tier.max_distance <= 0) {
        errors[index] = {
          ...errors[index],
          distance: t('merchant.delivery.distanceForm.mustBeGreaterThanZero'),
        };
        isValid = false;
      }

      if (tier.fee < 0) {
        errors[index] = {
          ...errors[index],
          fee: t('merchant.delivery.distanceForm.mustBeZeroOrGreater'),
        };
        isValid = false;
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  const handleTierInputChange = (index: number, field: 'distance' | 'fee', value: string) => {
    const newInputs = [...tierInputs];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setTierInputs(newInputs);

    // Try to parse and update tiers
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && value !== '') {
      const newTiers = [...customTiers];
      if (field === 'distance') {
        newTiers[index] = { ...newTiers[index], max_distance: numValue };
      } else {
        newTiers[index] = { ...newTiers[index], fee: numValue };
      }
      setCustomTiers(newTiers);
      const maxFee = watchedValues.maxDeliveryFee ? parseFloat(watchedValues.maxDeliveryFee) : undefined;
      validateTiers(newTiers, maxFee);
    }
  };

  const handleAddTier = () => {
    const lastTier = customTiers[customTiers.length - 1];
    const newTier = { max_distance: lastTier.max_distance + 200, fee: lastTier.fee + 10 };
    setCustomTiers([...customTiers, newTier]);
    setTierInputs([...tierInputs, { distance: newTier.max_distance.toString(), fee: newTier.fee.toString() }]);
    setValidationErrors({});
  };

  const handleRemoveTier = (index: number) => {
    if (customTiers.length <= 1) return;
    const newTiers = customTiers.filter((_, i) => i !== index);
    const newInputs = tierInputs.filter((_, i) => i !== index);
    setCustomTiers(newTiers);
    setTierInputs(newInputs);
    const maxFee = watchedValues.maxDeliveryFee ? parseFloat(watchedValues.maxDeliveryFee) : undefined;
    validateTiers(newTiers, maxFee);
  };

  const handleResetToDefaults = () => {
    setCustomTiers(DEFAULT_TIERS);
    setTierInputs(DEFAULT_TIERS.map(t => ({ distance: t.max_distance.toString(), fee: t.fee.toString() })));
    const maxFee = watchedValues.maxDeliveryFee ? parseFloat(watchedValues.maxDeliveryFee) : undefined;
    validateTiers(DEFAULT_TIERS, maxFee);
  };

  // Re-validate tiers when maxDeliveryFee changes
  useEffect(() => {
    if (distanceMode === 'custom' && watchedValues.maxDeliveryFee) {
      const maxFee = parseFloat(watchedValues.maxDeliveryFee);
      if (!isNaN(maxFee)) {
        validateTiers(customTiers, maxFee);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues.maxDeliveryFee, distanceMode]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

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
            <Text className="text-xl font-semibold text-gray-900">{t('merchant.delivery.distanceForm.title')}</Text>
            <Text className="text-xs text-gray-500 mt-2">
              {t('merchant.delivery.distanceForm.description')}
            </Text>
          </View>
          
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Distance Mode Toggle */}
            <View className="mt-6">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.distanceForm.distancePricingMode')}</Text>
                  <Text className="text-xs text-gray-500 mt-1">
                    {distanceMode === 'auto' 
                      ? t('merchant.delivery.distanceForm.autoModeDesc')
                      : t('merchant.delivery.distanceForm.customModeDesc')}
                  </Text>
                </View>
                <View className="flex-row items-center space-x-2">
                  <Text className="text-xs text-gray-600">{t('merchant.delivery.distanceForm.auto')}</Text>
                  <Switch 
                    value={distanceMode === 'custom'} 
                    onValueChange={(val) => setDistanceMode(val ? 'custom' : 'auto')}
                  />
                  <Text className="text-xs text-gray-600">{t('merchant.delivery.distanceForm.custom')}</Text>
                </View>
              </View>

              {distanceMode === 'auto' ? (
                <View className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1">
                  <Text className="text-xs font-semibold text-blue-900 mb-2">{t('merchant.delivery.distanceForm.defaultTiers')}</Text>
                  {[
                    { max_distance: 200, fee: 20 },
                    { max_distance: 400, fee: 30 },
                    { max_distance: 600, fee: 40 },
                    { max_distance: 800, fee: 50 },
                    { max_distance: 1000, fee: 60 },
                  ].map((tier, index, arr) => (
                    <View key={index} className="flex-row justify-between">
                      <Text className="text-xs text-blue-900">
                        {index === 0 ? '≤' : `${arr[index - 1].max_distance + 1} -`} {tier.max_distance}m
                      </Text>
                      <Text className="text-xs font-semibold text-blue-900">Rs {tier.fee}</Text>
                    </View>
                  ))}
                  <View className="flex-row justify-between pt-1 border-t border-blue-200">
                    <Text className="text-xs text-blue-900">
                      {t('merchant.delivery.distanceForm.beyond', { distance: DEFAULT_TIERS[DEFAULT_TIERS.length - 1].max_distance })}
                    </Text>
                    <Text className="text-xs font-semibold text-blue-900">
                      {t('merchant.delivery.distanceForm.linearScaling', {
                        fee: watchedValues.beyondTierFeePerUnit ? parseFloat(watchedValues.beyondTierFeePerUnit).toFixed(0) : (defaultLogic?.beyondTierFeePerUnit.toFixed(0) || '10'),
                        unit: watchedValues.beyondTierDistanceUnit ? parseFloat(watchedValues.beyondTierDistanceUnit).toFixed(0) : (defaultLogic?.beyondTierDistanceUnit.toFixed(0) || '250')
                      })}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="space-y-2">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-xs font-semibold text-gray-700">{t('merchant.delivery.distanceForm.customTiers')}</Text>
                    <TouchableOpacity
                      onPress={handleResetToDefaults}
                      className="bg-gray-100 rounded-lg px-3 py-1"
                    >
                      <Text className="text-xs font-semibold text-gray-700">{t('merchant.delivery.distanceForm.resetToDefaults')}</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Header Row */}
                  <View className="flex-row items-center px-1 mb-1">
                    <Text className="flex-1 text-xs font-semibold text-gray-600">{t('merchant.delivery.distanceForm.distance')}</Text>
                    <Text className="flex-1 text-xs font-semibold text-gray-600 ml-2">{t('merchant.delivery.distanceForm.fee')}</Text>
                    <View style={{ width: 32 }} />
                  </View>

                  {customTiers.map((tier, index) => (
                    <View key={index}>
                      <View className="flex-row items-center space-x-2">
                        <View className="flex-1 flex-row space-x-2">
                          <View className="flex-1">
                            <TextInput
                              value={tierInputs[index]?.distance || ''}
                              onChangeText={(val) => handleTierInputChange(index, 'distance', val)}
                              keyboardType="number-pad"
                              className={`border rounded-lg px-3 py-2 text-sm text-gray-900 ${
                                validationErrors[index]?.distance 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-gray-200 bg-white'
                              }`}
                              placeholder="0"
                            />
                          </View>
                          <View className="flex-1">
                            <TextInput
                              value={tierInputs[index]?.fee || ''}
                              onChangeText={(val) => handleTierInputChange(index, 'fee', val)}
                              keyboardType="decimal-pad"
                              className={`border rounded-lg px-3 py-2 text-sm text-gray-900 ${
                                validationErrors[index]?.fee 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-gray-200 bg-white'
                              }`}
                              placeholder="0"
                            />
                          </View>
                        </View>
                        {customTiers.length > 1 && (
                          <TouchableOpacity
                            onPress={() => handleRemoveTier(index)}
                            className="p-2"
                            style={{ width: 32, alignItems: 'center' }}
                          >
                            <Text className="text-red-600 text-xl font-bold">×</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {/* Validation errors */}
                      {(validationErrors[index]?.distance || validationErrors[index]?.fee) && (
                        <View className="mt-1 px-1">
                          {validationErrors[index]?.distance && (
                            <Text className="text-xs text-red-500">{validationErrors[index].distance}</Text>
                          )}
                          {validationErrors[index]?.fee && (
                            <Text className="text-xs text-red-500">{validationErrors[index].fee}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                  
                  <TouchableOpacity
                    onPress={handleAddTier}
                    className="border border-dashed border-blue-300 rounded-lg py-2 items-center mt-2"
                  >
                    <Text className="text-sm font-semibold text-blue-600">{t('merchant.delivery.distanceForm.addTier')}</Text>
                  </TouchableOpacity>

                  {hasValidationErrors && (
                    <View className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                      <Text className="text-xs text-red-700">
                        {t('merchant.delivery.distanceForm.fixValidationErrors')}
                      </Text>
                    </View>
                  )}

                  {customTiers.length > 0 && (
                    <View className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <Text className="text-xs text-gray-600">
                        {t('merchant.delivery.distanceForm.beyondLastTier', {
                          distance: customTiers[customTiers.length - 1].max_distance,
                          fee: watchedValues.beyondTierFeePerUnit ? parseFloat(watchedValues.beyondTierFeePerUnit).toFixed(0) : (defaultLogic?.beyondTierFeePerUnit.toFixed(0) || '10'),
                          unit: watchedValues.beyondTierDistanceUnit ? parseFloat(watchedValues.beyondTierDistanceUnit).toFixed(0) : (defaultLogic?.beyondTierDistanceUnit.toFixed(0) || '250')
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Max Delivery Fee */}
            <View className="mt-5">
              <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.distanceForm.maxDeliveryFee')}</Text>
              <Text className="text-xs text-gray-500 mt-1">
                {t('merchant.delivery.distanceForm.maxDeliveryFeeDesc')}
              </Text>
              <Controller
                control={control}
                name="maxDeliveryFee"
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
                      placeholder={t('merchant.delivery.distanceForm.maxDeliveryFeePlaceholder')}
                    />
                    {fieldState.error ? (
                      <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                    ) : null}
                  </>
                )}
              />
            </View>

            {/* Linear Scaling After Last Tier */}
            <View className="mt-5">
              <Text className="text-sm font-semibold text-gray-700">{t('merchant.delivery.distanceForm.linearScalingTitle')}</Text>
              <Text className="text-xs text-gray-500 mt-1">
                {t('merchant.delivery.distanceForm.linearScalingDesc')}
              </Text>
              
              <View className="flex-row space-x-3 mt-3">
                <View className="flex-1">
                  <Text className="text-xs text-gray-600 mb-1">{t('merchant.delivery.distanceForm.feePerUnit')}</Text>
                  <Controller
                    control={control}
                    name="beyondTierFeePerUnit"
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
                          className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                          placeholder={t('merchant.delivery.distanceForm.feePerUnitPlaceholder')}
                        />
                        {fieldState.error ? (
                          <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                        ) : null}
                      </>
                    )}
                  />
                </View>
                
                <View className="flex-1">
                  <Text className="text-xs text-gray-600 mb-1">{t('merchant.delivery.distanceForm.distanceUnit')}</Text>
                  <Controller
                    control={control}
                    name="beyondTierDistanceUnit"
                    render={({ field: { value, onChange }, fieldState }) => (
                      <>
                        <TextInput
                          value={value}
                          onChangeText={(text) => {
                            if (text === '' || /^\d+(\.\d+)?$/.test(text)) {
                              onChange(text);
                            }
                          }}
                          keyboardType="decimal-pad"
                          className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                          placeholder={t('merchant.delivery.distanceForm.distanceUnitPlaceholder')}
                        />
                        {fieldState.error ? (
                          <Text className="text-xs text-red-500 mt-1">{fieldState.error.message}</Text>
                        ) : null}
                      </>
                    )}
                  />
                </View>
              </View>
              
              <View className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <Text className="text-xs text-blue-900">
                  {t('merchant.delivery.distanceForm.linearScalingExample', {
                    fee: watchedValues.beyondTierFeePerUnit || '10',
                    unit: watchedValues.beyondTierDistanceUnit || '250'
                  })}
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
                <Text className="text-sm font-semibold text-gray-600">{t('merchant.delivery.distanceForm.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center"
                onPress={handleSubmit((values) => {
                  // Validate custom tiers before submitting
                  const maxFee = parseFloat(values.maxDeliveryFee);
                  if (distanceMode === 'custom' && !validateTiers(customTiers, maxFee)) {
                    return;
                  }

                  onSubmit({
                    distanceMode,
                    maxDeliveryFee: maxFee,
                    distanceTiers: distanceMode === 'custom' ? customTiers : undefined,
                    beyondTierFeePerUnit: parseFloat(values.beyondTierFeePerUnit),
                    beyondTierDistanceUnit: parseFloat(values.beyondTierDistanceUnit),
                  });
                })}
                disabled={loading || (distanceMode === 'custom' && hasValidationErrors)}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-semibold text-white">{t('merchant.delivery.distanceForm.saveSettings')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

