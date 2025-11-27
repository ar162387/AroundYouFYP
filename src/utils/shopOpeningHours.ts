import type { MerchantShop } from '../services/merchant/shopService';

export type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface DayOpeningHours {
  enabled: boolean;
  open: string; // "HH:MM" 24h
  close: string; // "HH:MM" 24h
}

export type OpeningHoursConfig = Record<DayKey, DayOpeningHours>;

export interface ShopHoliday {
  date: string; // "YYYY-MM-DD"
  description: string;
}

export type OpenStatusMode = 'auto' | 'manual_open' | 'manual_closed';

export type OpeningStatusReason =
  | 'manual_open'
  | 'manual_closed'
  | 'holiday'
  | 'schedule_closed'
  | 'outside_hours'
  | 'no_schedule';

export interface OpeningStatus {
  isOpen: boolean;
  reason: OpeningStatusReason;
  // When closed due to holiday, we surface the holiday description
  holidayDescription?: string;
}

type ShopWithSchedule = Pick<
  MerchantShop,
  'opening_hours' | 'holidays'
> & {
  open_status_mode?: OpenStatusMode | null;
};

function getTodayKey(date: Date): DayKey {
  // JS: 0 = Sunday, 6 = Saturday
  const day = date.getDay();
  switch (day) {
    case 0:
      return 'sunday';
    case 1:
      return 'monday';
    case 2:
      return 'tuesday';
    case 3:
      return 'wednesday';
    case 4:
      return 'thursday';
    case 5:
      return 'friday';
    case 6:
    default:
      return 'saturday';
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeToDate(base: Date, time: string): Date | null {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function getCurrentOpeningStatus(
  shop: ShopWithSchedule,
  now: Date = new Date(),
): OpeningStatus {
  const mode = shop.open_status_mode ?? 'auto';

  if (mode === 'manual_open') {
    return { isOpen: true, reason: 'manual_open' };
  }

  if (mode === 'manual_closed') {
    return { isOpen: false, reason: 'manual_closed' };
  }

  const openingHours = shop.opening_hours as OpeningHoursConfig | null | undefined;
  const holidays = (shop.holidays || []) as ShopHoliday[];

  if (!openingHours) {
    return { isOpen: true, reason: 'no_schedule' };
  }

  const todayKey = getTodayKey(now);
  const todayConfig = openingHours[todayKey];

  // Holiday override
  const todayStr = formatDate(now);
  const holiday = holidays.find((h) => h.date === todayStr);
  if (holiday) {
    return {
      isOpen: false,
      reason: 'holiday',
      holidayDescription: holiday.description,
    };
  }

  if (!todayConfig || !todayConfig.enabled) {
    return { isOpen: false, reason: 'schedule_closed' };
  }

  const openAt = parseTimeToDate(now, todayConfig.open);
  const closeAt = parseTimeToDate(now, todayConfig.close);

  if (!openAt || !closeAt) {
    return { isOpen: true, reason: 'no_schedule' };
  }

  if (now >= openAt && now < closeAt) {
    return { isOpen: true, reason: 'auto' };
  }

  return { isOpen: false, reason: 'outside_hours' };
}


