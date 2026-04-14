import crashlytics from '@react-native-firebase/crashlytics';

type CrashValue = string | number | boolean | null | undefined;
type CrashData = Record<string, CrashValue>;

const MAX_LOG_LENGTH = 900;

function toStringMap(data: CrashData): Record<string, string> {
  const result: Record<string, string> = {};
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value === undefined) return;
    result[key] = String(value);
  });
  return result;
}

function truncate(message: string): string {
  if (message.length <= MAX_LOG_LENGTH) return message;
  return `${message.slice(0, MAX_LOG_LENGTH - 3)}...`;
}

export function logCrashEvent(message: string, data?: CrashData): void {
  try {
    if (!data) {
      crashlytics().log(truncate(message));
      return;
    }
    const payload = JSON.stringify(toStringMap(data));
    crashlytics().log(truncate(`${message} | ${payload}`));
  } catch (error) {
    console.warn('Crashlytics log failed:', error);
  }
}

export function setCrashAttributes(data: CrashData): void {
  try {
    crashlytics().setAttributes(toStringMap(data));
  } catch (error) {
    console.warn('Crashlytics setAttributes failed:', error);
  }
}

export function setCrashUserId(userId: string | null): void {
  try {
    crashlytics().setUserId(userId || '');
  } catch (error) {
    console.warn('Crashlytics setUserId failed:', error);
  }
}

export function recordCrashError(
  error: unknown,
  message?: string,
  data?: CrashData
): void {
  try {
    if (message) {
      logCrashEvent(message, data);
    }
    if (error instanceof Error) {
      crashlytics().recordError(error);
    } else {
      crashlytics().recordError(
        new Error(typeof error === 'string' ? error : 'Non-Error thrown')
      );
    }
  } catch (crashError) {
    console.warn('Crashlytics recordError failed:', crashError);
  }
}
