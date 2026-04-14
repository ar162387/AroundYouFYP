import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as merchantService from '../../services/merchant/merchantService';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.75);

const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeToNoon(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoToLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(y, mo, day, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function buildVerificationSchema(t: TFunction) {
  return z.object({
    name_as_per_cnic: z
      .string()
      .min(1, t('merchant.verification.nameRequired'))
      .min(3, t('merchant.verification.nameMinLength'))
      .refine((s) => !/\d/.test(s.trim()), t('merchant.verification.nameNoDigits')),
    cnic: z
      .string()
      .min(1, t('merchant.verification.cnicRequired'))
      .regex(cnicRegex, t('merchant.verification.cnicInvalidFormat')),
    cnic_expiry: z
      .string()
      .min(1, t('merchant.verification.expiryRequired'))
      .regex(/^\d{4}-\d{2}-\d{2}$/, t('merchant.verification.expiryInvalid'))
      .refine((val) => {
        const parsed = parseIsoToLocalDate(val);
        if (!parsed) return false;
        const expiry = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        expiry.setHours(0, 0, 0, 0);
        const today = startOfToday();
        return expiry >= today;
      }, t('merchant.verification.expiryMustBeTodayOrLater')),
  });
}

type VerificationFormState = z.infer<ReturnType<typeof buildVerificationSchema>>;

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
  userName,
  loading,
  onClose,
  onSubmit,
}: VerificationFormSheetProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';

  const schema = useMemo(() => buildVerificationSchema(t), [t, i18n.language]);

  const [expiryPickerVisible, setExpiryPickerVisible] = useState(false);
  const [expiryPickerDate, setExpiryPickerDate] = useState(() => normalizeToNoon(startOfToday()));
  const expiryFieldOnChangeRef = useRef<((iso: string) => void) | null>(null);

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

  useEffect(() => {
    if (!visible) {
      setExpiryPickerVisible(false);
      expiryFieldOnChangeRef.current = null;
    }
  }, [visible]);

  const formatCNIC = (text: string): string => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
  };

  const openExpiryPicker = (currentValue: string, onFieldChange: (iso: string) => void) => {
    const min = startOfToday();
    const parsed = currentValue ? parseIsoToLocalDate(currentValue) : null;
    let initial = parsed && parsed >= min ? parsed : min;
    initial = normalizeToNoon(initial);
    setExpiryPickerDate(initial);
    expiryFieldOnChangeRef.current = onFieldChange;
    setExpiryPickerVisible(true);
  };

  const commitExpiryFromPicker = () => {
    const cb = expiryFieldOnChangeRef.current;
    const min = startOfToday();
    const chosen = expiryPickerDate < min ? min : expiryPickerDate;
    const iso = toIsoDateLocal(normalizeToNoon(chosen));
    if (cb) cb(iso);
    expiryFieldOnChangeRef.current = null;
    setExpiryPickerVisible(false);
  };

  const cancelExpiryPicker = () => {
    expiryFieldOnChangeRef.current = null;
    setExpiryPickerVisible(false);
  };

  const onAndroidExpiryChange = (event: { type: string }, selectedDate?: Date) => {
    setExpiryPickerVisible(false);
    const cb = expiryFieldOnChangeRef.current;
    expiryFieldOnChangeRef.current = null;
    if (event.type === 'set' && selectedDate && cb) {
      cb(toIsoDateLocal(normalizeToNoon(selectedDate)));
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
                      onChangeText={(text) => onChange(text.replace(/\d/g, ''))}
                      className={`mt-2 border ${fieldState.error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-base text-gray-900 bg-white ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('merchant.verification.nameAsPerCNICPlaceholder')}
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="words"
                    />
                    {fieldState.error && (
                      <Text className="text-red-500 text-xs mt-1">{fieldState.error.message}</Text>
                    )}
                  </>
                )}
              />
            </View>

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
                      onChangeText={(text) => onChange(formatCNIC(text))}
                      keyboardType="number-pad"
                      maxLength={15}
                      className={`mt-2 border ${fieldState.error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 text-base text-gray-900 bg-white ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder="12345-1234567-1"
                      placeholderTextColor="#9CA3AF"
                    />
                    {fieldState.error && (
                      <Text className="text-red-500 text-xs mt-1">{fieldState.error.message}</Text>
                    )}
                  </>
                )}
              />
            </View>

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
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openExpiryPicker(value, onChange)}
                      className={`mt-2 border ${fieldState.error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 bg-white justify-center`}
                    >
                      <Text
                        className={`text-base ${value ? 'text-gray-900' : 'text-gray-400'} ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {value || t('merchant.verification.selectExpiryDate')}
                      </Text>
                    </TouchableOpacity>
                    {Platform.OS === 'android' && expiryPickerVisible && (
                      <DateTimePicker
                        value={expiryPickerDate}
                        mode="date"
                        display="default"
                        minimumDate={startOfToday()}
                        onChange={onAndroidExpiryChange}
                      />
                    )}
                    {fieldState.error && (
                      <Text className="text-red-500 text-xs mt-1">{fieldState.error.message}</Text>
                    )}
                  </>
                )}
              />
            </View>
          </ScrollView>

          <View className="px-6 py-4 border-t border-gray-100 bg-white">
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={onClose}
                disabled={loading}
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center justify-center"
              >
                <Text className="text-gray-700 font-semibold text-base">{t('merchant.verification.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit(onFormSubmit)}
                disabled={loading || !formState.isValid}
                className={`flex-1 rounded-xl py-3 items-center justify-center ${loading || !formState.isValid ? 'bg-gray-300' : 'bg-blue-600'}`}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">{t('merchant.verification.submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {Platform.OS === 'ios' && (
        <Modal
          visible={expiryPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={cancelExpiryPicker}
        >
          <View className="flex-1 bg-black/50 justify-center items-center px-4">
            <View className="bg-white rounded-3xl p-5 w-full max-w-sm">
              <Text className="text-lg font-semibold text-gray-900 mb-4 text-center">
                {t('merchant.verification.cnicExpiry')}
              </Text>
              <DateTimePicker
                value={expiryPickerDate}
                mode="date"
                display="spinner"
                minimumDate={startOfToday()}
                onChange={(_, selectedDate) => {
                  if (selectedDate) setExpiryPickerDate(normalizeToNoon(selectedDate));
                }}
                style={{ height: 180 }}
              />
              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  onPress={cancelExpiryPicker}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-white"
                  activeOpacity={0.7}
                >
                  <Text className="text-center text-gray-700 font-semibold">{t('merchant.verification.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={commitExpiryFromPicker}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600"
                  activeOpacity={0.8}
                >
                  <Text className="text-center text-white font-semibold">{t('merchant.verification.confirmDate')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}
