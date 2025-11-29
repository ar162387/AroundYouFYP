import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Pressable, Dimensions } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import * as merchantService from '../../services/merchant/merchantService';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.75);

// CNIC format: 12345-1234567-1 (5 digits, 7 digits, 1 digit)
const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

const schema = z.object({
  name_as_per_cnic: z
    .string()
    .min(1, 'Name is required')
    .min(3, 'Name must be at least 3 characters'),
  cnic: z
    .string()
    .min(1, 'CNIC is required')
    .regex(cnicRegex, 'CNIC must be in format: 12345-1234567-1'),
  cnic_expiry: z
    .string()
    .min(1, 'Expiry date is required')
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, 'Invalid date'),
}).refine(
  (data) => {
    const expiryDate = new Date(data.cnic_expiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiryDate > today;
  },
  {
    message: 'CNIC must not be expired',
    path: ['cnic_expiry'],
  }
);

type VerificationFormState = z.infer<typeof schema>;

type VerificationFormSheetProps = {
  visible: boolean;
  merchantAccount: merchantService.MerchantAccount | null;
  userEmail?: string | null;
  userName?: string | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: merchantService.VerificationData) => Promise<void>;
};

export function VerificationFormSheet({
  visible,
  merchantAccount,
  userEmail,
  userName,
  loading,
  onClose,
  onSubmit,
}: VerificationFormSheetProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';

  const defaultValues = useMemo(() => {
    return {
      name_as_per_cnic: merchantAccount?.name_as_per_cnic || userName || '',
      cnic: merchantAccount?.cnic || '',
      cnic_expiry: merchantAccount?.cnic_expiry || '',
    };
  }, [merchantAccount, userName]);

  const { control, handleSubmit, reset, formState } = useForm<VerificationFormState>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (visible) {
      reset(defaultValues);
    }
  }, [visible, reset, defaultValues]);

  const formatCNIC = (text: string): string => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');
    
    // Format: 12345-1234567-1
    if (digits.length <= 5) {
      return digits;
    } else if (digits.length <= 12) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
    }
  };

  const onFormSubmit = async (data: VerificationFormState) => {
    await onSubmit({
      name_as_per_cnic: data.name_as_per_cnic.trim(),
      cnic: data.cnic,
      cnic_expiry: data.cnic_expiry,
    });
  };

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl" style={{ height: SHEET_HEIGHT }}>
          {/* Grabber Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </View>

          <View className={`px-6 pb-3 border-b border-gray-100 ${isRTL ? 'items-end' : 'items-start'}`}>
            <Text className={`text-xl font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('merchant.verification.formTitle')}
            </Text>
            <Text className={`text-xs text-gray-500 mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('merchant.verification.formDescription')}
            </Text>
          </View>

          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Name as per CNIC */}
            <View className="mt-6">
              <Text className={`text-sm font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('merchant.verification.nameAsPerCNIC')}
              </Text>
              <Text className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('merchant.verification.nameAsPerCNICDesc')}
              </Text>
              <Controller
                control={control}
                name="name_as_per_cnic"
                render={({ field: { value, onChange }, fieldState }) => (
                  <>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      className={`mt-2 border ${fieldState.error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-base text-gray-900 bg-white ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('merchant.verification.nameAsPerCNICPlaceholder')}
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="words"
                    />
                    {fieldState.error && (
                      <Text className="text-red-500 text-xs mt-1">
                        {fieldState.error.message}
                      </Text>
                    )}
                  </>
                )}
              />
            </View>

            {/* CNIC */}
            <View className="mt-6">
              <Text className={`text-sm font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('merchant.verification.cnic')}
              </Text>
              <Text className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('merchant.verification.cnicDesc')}
              </Text>
              <Controller
                control={control}
                name="cnic"
                render={({ field: { value, onChange }, fieldState }) => (
                  <>
                    <TextInput
                      value={value}
                      onChangeText={(text) => {
                        const formatted = formatCNIC(text);
                        onChange(formatted);
                      }}
                      keyboardType="number-pad"
                      maxLength={15} // 12345-1234567-1
                      className={`mt-2 border ${fieldState.error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-base text-gray-900 bg-white ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder="12345-1234567-1"
                      placeholderTextColor="#9CA3AF"
                    />
                    {fieldState.error && (
                      <Text className="text-red-500 text-xs mt-1">
                        {fieldState.error.message}
                      </Text>
                    )}
                  </>
                )}
              />
            </View>

            {/* CNIC Expiry */}
            <View className="mt-6">
              <Text className={`text-sm font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('merchant.verification.cnicExpiry')}
              </Text>
              <Text className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('merchant.verification.cnicExpiryDesc')}
              </Text>
              <Controller
                control={control}
                name="cnic_expiry"
                render={({ field: { value, onChange }, fieldState }) => (
                  <>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      keyboardType="default"
                      className={`mt-2 border ${fieldState.error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-base text-gray-900 bg-white ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                    />
                    {fieldState.error && (
                      <Text className="text-red-500 text-xs mt-1">
                        {fieldState.error.message}
                      </Text>
                    )}
                  </>
                )}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View className="px-6 py-4 border-t border-gray-100 bg-white">
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={onClose}
                disabled={loading}
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center justify-center"
              >
                <Text className="text-gray-700 font-semibold text-base">
                  {t('merchant.verification.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit(onFormSubmit)}
                disabled={loading || !formState.isValid}
                className={`flex-1 rounded-xl py-3 items-center justify-center ${loading || !formState.isValid ? 'bg-gray-300' : 'bg-blue-600'}`}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    {t('merchant.verification.submit')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

