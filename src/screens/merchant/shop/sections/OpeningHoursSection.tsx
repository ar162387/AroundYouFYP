import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Platform,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import type { MerchantShop, UpdateShopData } from '../../../../services/merchant/shopService';
import { updateShop } from '../../../../services/merchant/shopService';
import {
  type DayKey,
  type DayOpeningHours,
  type OpeningHoursConfig,
  type ShopHoliday,
  type OpenStatusMode,
  getCurrentOpeningStatus,
} from '../../../../utils/shopOpeningHours';
import { useAuth } from '../../../../context/AuthContext';

type OpeningHoursSectionProps = {
  shop: MerchantShop;
  onShopUpdated: (shop: MerchantShop) => void;
};

type TimeField = 'open' | 'close';

type TimePickerState =
  | {
      visible: true;
      day: DayKey;
      field: TimeField;
      date: Date;
    }
  | {
      visible: false;
    };

const DEFAULT_DAY_CONFIG = {
  enabled: false,
  open: '09:00',
  close: '21:00',
} as const;

const DAYS_IN_ORDER: { key: DayKey; labelKey: string }[] = [
  { key: 'monday', labelKey: 'merchant.openingHours.days.monday' },
  { key: 'tuesday', labelKey: 'merchant.openingHours.days.tuesday' },
  { key: 'wednesday', labelKey: 'merchant.openingHours.days.wednesday' },
  { key: 'thursday', labelKey: 'merchant.openingHours.days.thursday' },
  { key: 'friday', labelKey: 'merchant.openingHours.days.friday' },
  { key: 'saturday', labelKey: 'merchant.openingHours.days.saturday' },
  { key: 'sunday', labelKey: 'merchant.openingHours.days.sunday' },
];

function ensureOpeningConfig(
  existing: OpeningHoursConfig | null | undefined,
): OpeningHoursConfig {
  const base: Partial<OpeningHoursConfig> = { ...(existing || {}) };
  (DAYS_IN_ORDER.map((d) => d.key) as DayKey[]).forEach((day) => {
    if (!base[day]) {
      base[day] = { ...DEFAULT_DAY_CONFIG };
    }
  });
  return base as OpeningHoursConfig;
}

function parseTimeString(time: string): Date {
  const [h, m] = time.split(':').map((v) => Number(v));
  const d = new Date();
  d.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return d;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDateLocal(date: Date): string {
  // Extract local date components directly to avoid timezone conversion issues
  // Use local timezone methods to ensure we get the correct date as the user selected
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  
  // Format as YYYY-MM-DD using local components
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTimeDisplay(time: string, locale: string): string {
  try {
    const d = parseTimeString(time);
    return d.toLocaleTimeString(locale || 'en-PK', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return time;
  }
}

export default function OpeningHoursSection({
  shop,
  onShopUpdated,
}: OpeningHoursSectionProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [config, setConfig] = useState<OpeningHoursConfig>(() =>
    ensureOpeningConfig(shop.opening_hours),
  );
  const [holidays, setHolidays] = useState<ShopHoliday[]>(() => shop.holidays || []);
  const [mode, setMode] = useState<OpenStatusMode>(() => shop.open_status_mode || 'auto');
  const [newHolidayDate, setNewHolidayDate] = useState<Date | null>(null);
  const [newHolidayDescription, setNewHolidayDescription] = useState('');
  const [timePicker, setTimePicker] = useState<TimePickerState>({ visible: false });
  const [holidayDatePickerVisible, setHolidayDatePickerVisible] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const isInitialMount = useRef(true);

  const openingStatus = useMemo(
    () =>
      getCurrentOpeningStatus({
        opening_hours: config,
        holidays,
        open_status_mode: mode,
      }),
    [config, holidays, mode],
  );

  const handleToggleDay = (day: DayKey) => {
    setConfig((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
      },
    }));
    // Auto-save will be triggered by useEffect
  };

  const openTimePicker = (day: DayKey, field: TimeField) => {
    const current = config[day];
    const timeStr = field === 'open' ? current.open : current.close;
    setTimePicker({
      visible: true,
      day,
      field,
      date: parseTimeString(timeStr),
    });
  };

  const closeTimePicker = () => {
    setTimePicker({ visible: false });
  };

  const handleTimeChange = (
    event: any,
    selectedDate?: Date | undefined,
  ) => {
    if (!timePicker.visible) {
      return;
    }

    // Capture day and field before any async operations
    const { day, field } = timePicker;

    if (Platform.OS === 'android') {
      // Android: check if user dismissed the picker
      // Event type is 'dismissed' when user presses cancel/back
      if (event && event.type === 'dismissed') {
        closeTimePicker();
        return;
      }

      // On Android, when user presses OK, selectedDate will be provided
      // Always save if we have a valid selectedDate
      if (selectedDate && selectedDate instanceof Date) {
        const newTime = formatTime(selectedDate);
        const initialTime = formatTime(timePicker.date);
        
        // Only update if the time actually changed from the initial picker value
        // This prevents saving when onChange fires with the initial value on open
        if (newTime !== initialTime) {
          // Update the config with the new time
          setConfig((prev) => ({
            ...prev,
            [day]: {
              ...prev[day],
              [field]: newTime,
            } as DayOpeningHours,
          }));
        }
      }
      
      // Always close the picker after handling (even if no change)
      closeTimePicker();
    } else {
      // iOS: only update the picker's date state, don't update config yet
      // Config will be updated when user confirms
      if (!selectedDate) return;
      
      setTimePicker((prev) => {
        if (!prev.visible) return prev;
        return {
          ...prev,
          date: selectedDate,
        };
      });
      // Don't update config here - wait for user to confirm
    }
  };

  const handleTimePickerConfirm = () => {
    if (!timePicker.visible) return;
    // On iOS, update config when user confirms
    // The date in timePicker.state is already up-to-date from handleTimeChange
    const { day, field } = timePicker;
    const value = formatTime(timePicker.date);
    setConfig((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      } as DayOpeningHours,
    }));
    closeTimePicker();
    // Auto-save will be triggered by useEffect after picker closes
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) {
      Alert.alert(t('merchant.openingHours.holidays.dateRequired'));
      return;
    }

    const desc = newHolidayDescription.trim();
    const words = desc.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 6) {
      Alert.alert(t('merchant.openingHours.holidays.descriptionInvalid'));
      return;
    }

    const dateStr = formatDateLocal(newHolidayDate);

    if (holidays.some((h) => h.date === dateStr)) {
      Alert.alert(t('merchant.openingHours.holidays.duplicate'));
      return;
    }

    setHolidays((prev) => [
      ...prev,
      { date: dateStr, description: desc },
    ]);
    setNewHolidayDate(null);
    setNewHolidayDescription('');
    // Auto-save will be triggered by useEffect
  };

  const handleRemoveHoliday = (date: string) => {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
    // Auto-save will be triggered by useEffect
  };

  const handleModeChange = (newMode: OpenStatusMode) => {
    // Only allow changing if it's different from current mode
    if (newMode === mode) return;
    
    // Set the new mode - auto-save will be triggered by useEffect
    setMode(newMode);
  };

  // Auto-save when config, holidays, or mode changes (with debounce)
  // But skip auto-save while time picker or holiday date picker is open
  useEffect(() => {
    // Skip auto-save on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Don't auto-save while pickers are open (user is still making selections)
    if (timePicker.visible || holidayDatePickerVisible) {
      return;
    }

    if (!user || isAutoSaving) return;

    const timer = setTimeout(async () => {
      try {
        setIsAutoSaving(true);

        const baseStatus = getCurrentOpeningStatus({
          opening_hours: config,
          holidays,
          open_status_mode: mode,
        });

        const payload: UpdateShopData = {
          opening_hours: config,
          holidays,
          open_status_mode: mode,
          is_open: mode === 'auto' ? baseStatus.isOpen : undefined,
        };

        const { shop: updated, error } = await updateShop(shop.id, user.id, payload);
        if (error || !updated) {
          console.error('Failed to auto-save opening hours', error);
          return;
        }

        onShopUpdated(updated);
      } catch (error) {
        console.error('Exception during auto-save:', error);
      } finally {
        setIsAutoSaving(false);
      }
    }, 500); // Debounce: save 500ms after last change

    return () => clearTimeout(timer);
  }, [config, holidays, mode, user, shop.id, onShopUpdated, isAutoSaving, timePicker.visible, holidayDatePickerVisible]);

  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK';

  return (
    <View className="flex-1">
      <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4">
        <Text className="text-xl font-semibold text-gray-900">
          {t('merchant.openingHours.title')}
        </Text>
        <Text className="text-sm text-gray-500 mt-2">
          {t('merchant.openingHours.subtitle')}
        </Text>

        <View className="mt-4 space-y-3">
          {(['auto', 'manual_open', 'manual_closed'] as OpenStatusMode[]).map(
            (value) => {
              const isActive = mode === value;
              const labelKey =
                value === 'auto'
                  ? 'merchant.openingHours.mode.auto'
                  : value === 'manual_open'
                  ? 'merchant.openingHours.mode.manualOpen'
                  : 'merchant.openingHours.mode.manualClosed';
              return (
                <View
                  key={value}
                  className="flex-row items-center justify-between py-2"
                >
                  <Text className="text-sm text-gray-900 font-medium">
                    {t(labelKey)}
                  </Text>
                  <Switch
                    value={isActive}
                    onValueChange={() => handleModeChange(value)}
                    disabled={isAutoSaving}
                    thumbColor={isActive ? '#2563eb' : '#f4f3f4'}
                    trackColor={{ true: '#93c5fd', false: '#d1d5db' }}
                  />
                </View>
              );
            },
          )}
        </View>

        <View className="mt-4">
          <Text className="text-xs font-semibold text-gray-600 mb-1">
            {t('merchant.openingHours.currentStatusLabel')}
          </Text>
          <Text className="text-sm text-gray-900 font-semibold">
            {openingStatus.isOpen
              ? t('merchant.openingHours.status.open')
              : t('merchant.openingHours.status.closed')}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly schedule */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4">
          <Text className="text-base font-semibold text-gray-900 mb-3">
            {t('merchant.openingHours.weeklyTitle')}
          </Text>
          <Text className="text-xs text-gray-500 mb-4">
            {t('merchant.openingHours.weeklySubtitle')}
          </Text>

          {DAYS_IN_ORDER.map(({ key, labelKey }) => {
            const dayConfig = config[key];
            return (
              <View
                key={key}
                className="flex-row items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <TouchableOpacity
                  onPress={() => handleToggleDay(key)}
                  className="flex-row items-center flex-1"
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-5 h-5 rounded-full mr-3 border ${
                      dayConfig.enabled
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-300'
                    } items-center justify-center`}
                  >
                    {dayConfig.enabled && (
                      <Text className="text-white text-xs">✓</Text>
                    )}
                  </View>
                  <Text className="text-sm text-gray-900">
                    {t(labelKey)}
                  </Text>
                </TouchableOpacity>

                <View className="flex-row items-center space-x-2">
                  <TouchableOpacity
                    onPress={() => openTimePicker(key, 'open')}
                    disabled={!dayConfig.enabled}
                    className={`px-3 py-1.5 rounded-full border ${
                      dayConfig.enabled
                        ? 'border-gray-300 bg-gray-50'
                        : 'border-gray-200 bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        dayConfig.enabled ? 'text-gray-800' : 'text-gray-400'
                      }`}
                    >
                      {formatTimeDisplay(dayConfig.open, locale)}
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-xs text-gray-400">–</Text>
                  <TouchableOpacity
                    onPress={() => openTimePicker(key, 'close')}
                    disabled={!dayConfig.enabled}
                    className={`px-3 py-1.5 rounded-full border ${
                      dayConfig.enabled
                        ? 'border-gray-300 bg-gray-50'
                        : 'border-gray-200 bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        dayConfig.enabled ? 'text-gray-800' : 'text-gray-400'
                      }`}
                    >
                      {formatTimeDisplay(dayConfig.close, locale)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Holidays */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4">
          <Text className="text-base font-semibold text-gray-900 mb-3">
            {t('merchant.openingHours.holidays.title')}
          </Text>
          <Text className="text-xs text-gray-500 mb-4">
            {t('merchant.openingHours.holidays.subtitle')}
          </Text>

          {holidays.length === 0 ? (
            <Text className="text-xs text-gray-400 mb-3">
              {t('merchant.openingHours.holidays.empty')}
            </Text>
          ) : (
            holidays
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((holiday) => (
                <View
                  key={holiday.date}
                  className="flex-row items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-sm text-gray-900">
                      {holiday.description}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {holiday.date}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveHoliday(holiday.date)}
                    className="px-2 py-1"
                  >
                    <Text className="text-xs text-red-500 font-semibold">
                      {t('merchant.openingHours.holidays.remove')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
          )}

          <View className="mt-4">
            <Text className="text-xs text-gray-600 mb-2">
              {t('merchant.openingHours.holidays.addTitle')}
            </Text>
            <View className="flex-row items-center mb-2">
              <TouchableOpacity
                onPress={() => {
                  // Initialize with current date if not set, but user can change it
                  // Normalize to local noon to avoid timezone issues
                  const baseDate = newHolidayDate || new Date();
                  const initialDate = new Date(
                    baseDate.getFullYear(),
                    baseDate.getMonth(),
                    baseDate.getDate(),
                    12, // Set to noon to avoid timezone edge cases
                    0,
                    0,
                    0
                  );
                  setNewHolidayDate(initialDate);
                  setHolidayDatePickerVisible(true);
                }}
                className="px-3 py-2 rounded-full border border-gray-300 bg-gray-50 mr-2"
              >
                <Text className="text-xs font-medium text-gray-800">
                  {newHolidayDate
                    ? formatDateLocal(newHolidayDate)
                    : t('merchant.openingHours.holidays.pickDate')}
                </Text>
              </TouchableOpacity>
              <View className="flex-1">
                <TextInput
                  value={newHolidayDescription}
                  onChangeText={setNewHolidayDescription}
                  placeholder={t(
                    'merchant.openingHours.holidays.descriptionPlaceholder',
                  )}
                  className="border border-gray-300 rounded-2xl px-3 py-2 text-xs text-gray-800"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
            <TouchableOpacity
              onPress={handleAddHoliday}
              className="mt-1 self-start px-3 py-1.5 rounded-full bg-blue-600"
              activeOpacity={0.8}
            >
              <Text className="text-xs font-semibold text-white">
                {t('merchant.openingHours.holidays.addButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {timePicker.visible && (
        <>
          {Platform.OS === 'ios' && (
            <View className="absolute inset-0 bg-black/50 items-center justify-center z-50">
              <View className="bg-white rounded-3xl p-5 w-[90%] max-w-sm">
                <Text className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  {t('merchant.openingHours.selectTime')}
                </Text>
                <DateTimePicker
                  value={timePicker.date}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  style={{ height: 180 }}
                />
                <View className="flex-row space-x-3 mt-4">
                  <TouchableOpacity
                    onPress={closeTimePicker}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-white"
                    activeOpacity={0.7}
                  >
                    <Text className="text-center text-gray-700 font-semibold">
                      {t('merchant.openingHours.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleTimePickerConfirm}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600"
                    activeOpacity={0.8}
                  >
                    <Text className="text-center text-white font-semibold">
                      {t('merchant.openingHours.confirm')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {Platform.OS === 'android' && timePicker.visible && (
            <DateTimePicker
              key={`${timePicker.day}-${timePicker.field}`}
              value={timePicker.date}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}
        </>
      )}

      {holidayDatePickerVisible && (
        <>
          {Platform.OS === 'ios' ? (
            <View className="absolute inset-0 bg-black/50 items-center justify-center z-50">
              <View className="bg-white rounded-3xl p-5 w-[90%] max-w-sm">
                <Text className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  {t('merchant.openingHours.holidays.selectDate')}
                </Text>
                <DateTimePicker
                  value={newHolidayDate || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      // Normalize the date to local noon to avoid timezone issues
                      const normalizedDate = new Date(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        selectedDate.getDate(),
                        12, // Set to noon to avoid timezone edge cases at midnight
                        0,
                        0,
                        0
                      );
                      setNewHolidayDate(normalizedDate);
                    }
                  }}
                  minimumDate={new Date()}
                  style={{ height: 180 }}
                />
                <View className="flex-row space-x-3 mt-4">
                  <TouchableOpacity
                    onPress={() => setHolidayDatePickerVisible(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-white"
                    activeOpacity={0.7}
                  >
                    <Text className="text-center text-gray-700 font-semibold">
                      {t('merchant.openingHours.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setHolidayDatePickerVisible(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600"
                    activeOpacity={0.8}
                  >
                    <Text className="text-center text-white font-semibold">
                      {t('merchant.openingHours.confirm')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <DateTimePicker
              value={newHolidayDate || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setHolidayDatePickerVisible(false);
                if (selectedDate) {
                  // Normalize the date to local noon to avoid timezone issues
                  const normalizedDate = new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate(),
                    12, // Set to noon to avoid timezone edge cases at midnight
                    0,
                    0,
                    0
                  );
                  setNewHolidayDate(normalizedDate);
                }
              }}
              minimumDate={new Date()}
            />
          )}
        </>
      )}
    </View>
  );
}


