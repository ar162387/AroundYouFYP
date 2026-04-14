import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const EXPIRES_AT_KEY = 'auth_expires_at';

let cachedToken: string | null = null;
let cachedExpiresAt: string | null = null;

export async function setAuthSession(accessToken: string, expiresAt: string): Promise<void> {
  cachedToken = accessToken;
  cachedExpiresAt = expiresAt;
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [EXPIRES_AT_KEY, expiresAt],
  ]);
}

export async function clearAuthSession(): Promise<void> {
  cachedToken = null;
  cachedExpiresAt = null;
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, EXPIRES_AT_KEY]);
}

export async function getAccessToken(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken;
  }
  cachedToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return cachedToken;
}

export async function getExpiresAt(): Promise<string | null> {
  if (cachedExpiresAt) {
    return cachedExpiresAt;
  }
  cachedExpiresAt = await AsyncStorage.getItem(EXPIRES_AT_KEY);
  return cachedExpiresAt;
}

export async function isSessionExpired(): Promise<boolean> {
  const expiresAt = await getExpiresAt();
  if (!expiresAt) {
    return true;
  }

  const expiryDate = new Date(expiresAt);
  return Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date();
}
