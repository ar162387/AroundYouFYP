import type { OrderStatus } from '../../types/orders';
import Config from 'react-native-config';
import { apiClient, toApiError } from '../apiClient';
import { getAccessToken } from '../authTokenStorage';
import { getCurrentUser } from '../authService';
import type {
  DayKey,
  DayOpeningHours,
  OpeningHoursConfig,
  ShopHoliday,
  OpenStatusMode,
} from '../../utils/shopOpeningHours';
import { getCurrentOpeningStatus } from '../../utils/shopOpeningHours';

export type ShopType = 'Grocery' | 'Meat' | 'Vegetable' | 'Stationery' | 'Dairy' | 'Pharmacy';

export interface CreateShopData {
  name: string;
  description: string;
  shop_type: ShopType;
  address: string;
  latitude: number;
  longitude: number;
  image_url?: string;
  tags?: string[];
}

export interface MerchantShop {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  shop_type: ShopType;
  address: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  tags: string[];
  is_open: boolean;
  // Optional scheduling fields (may be null for existing shops)
  opening_hours?: OpeningHoursConfig | null;
  holidays?: ShopHoliday[] | null;
  open_status_mode?: OpenStatusMode | null;
  orders_today: number; // Calculated field, not in DB
  orders_cancelled_today: number; // Calculated field, not in DB
  revenue_today: number; // Calculated field, not in DB
  created_at: string;
  updated_at: string;
}

export type UpdateShopData = Partial<CreateShopData> & {
  opening_hours?: OpeningHoursConfig | null;
  holidays?: ShopHoliday[] | null;
  open_status_mode?: OpenStatusMode | null;
  is_open?: boolean;
};

function isLocalImageUri(uri?: string | null): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
}

function getBackendBaseUrl(): string {
  return (
    Config.BACKEND_API_URL ||
    Config.DOTNET_API_URL ||
    Config.API_BASE_URL ||
    Config.BACKEND_URL ||
    ''
  ).replace(/\/+$/, '');
}

function toAbsoluteBackendUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) return url;
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${normalizedPath}`;
}

function normalizeShopImageUrl<T extends { image_url: string | null }>(shop: T): T {
  return {
    ...shop,
    image_url: toAbsoluteBackendUrl(shop.image_url),
  };
}

/** Backend sends revenue as `revenueTodayPkr` → snake `revenue_today_pkr` after apiClient key mapping. */
function merchantShopKpisFromApi(shop: MerchantShop): {
  orders_today: number;
  orders_cancelled_today: number;
  revenue_today: number;
} {
  const s = shop as MerchantShop & { revenue_today_pkr?: number };
  return {
    orders_today: s.orders_today ?? 0,
    orders_cancelled_today: s.orders_cancelled_today ?? 0,
    revenue_today: s.revenue_today ?? s.revenue_today_pkr ?? 0,
  };
}

async function uploadBinaryToMerchantEndpoint(
  endpoint: string,
  imageUri: string,
  filenamePrefix: string
): Promise<{ url: string | null; error: { message: string } | null }> {
  const token = await getAccessToken();
  if (!token) {
    return { url: null, error: { message: 'Not authenticated. Please log in again.' } };
  }
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return { url: null, error: { message: 'Backend API URL is missing.' } };
  }

  const extension = imageUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const mime = extension === 'png' ? 'image/png' : 'image/jpeg';
  const filename = `${filenamePrefix}-${Date.now()}.${extension}`;

  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: mime,
    name: filename,
  } as any);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData as any,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { url: null, error: { message: payload?.detail || payload?.message || 'Image upload failed' } };
  }

  return { url: toAbsoluteBackendUrl(payload.image_url || payload.imageUrl || null), error: null };
}

// Upload shop image to Supabase storage
export async function uploadShopImage(
  userId: string,
  imageUri: string
): Promise<{ url: string | null; error: { message: string } | null }> {
  void userId;
  return { url: imageUri, error: null };
}

// Upload item image to Supabase storage (1:1 aspect ratio for item cards)
export async function uploadItemImage(
  userId: string,
  imageUri: string
): Promise<{ url: string | null; error: { message: string } | null }> {
  void userId;
  return { url: imageUri, error: null };
}

// Pick image from device - this will be implemented in the component using react-native-image-picker
// For now, this is a placeholder function that can accept an image URI
export async function validateImageUri(uri: string): Promise<{ valid: boolean; error: { message: string } | null }> {
  try {
    if (!uri) {
      return { valid: false, error: { message: 'No image URI provided' } };
    }
    // Basic validation - in production, you might want to check file size, format, etc.
    return { valid: true, error: null };
  } catch (error: any) {
    return { valid: false, error: { message: error.message || 'Invalid image' } };
  }
}

// Create a new shop
export async function createShop(
  _userId: string,
  data: CreateShopData
): Promise<{ shop: MerchantShop | null; error: { message: string } | null }> {
  try {
    await getCurrentUser();
    const localImageUri = isLocalImageUri(data.image_url) ? data.image_url : null;
    const payload = { ...data, image_url: localImageUri ? null : data.image_url };
    const shop = await apiClient.post<MerchantShop>('/api/v1/merchant/shops', payload);

    let imageUrl = shop.image_url;
    if (localImageUri) {
      const upload = await uploadBinaryToMerchantEndpoint(
        `/api/v1/merchant/shops/${shop.id}/image`,
        localImageUri,
        `shop-${shop.id}`
      );
      if (!upload.error && upload.url) {
        imageUrl = upload.url;
      }
    }

    return {
      shop: normalizeShopImageUrl({
        ...shop,
        image_url: imageUrl,
        ...merchantShopKpisFromApi(shop),
      }),
      error: null,
    };
  } catch (error) {
    return { shop: null, error: { message: toApiError(error).message } };
  }
}

// Update an existing shop
export async function updateShop(
  shopId: string,
  _userId: string,
  data: UpdateShopData
): Promise<{ shop: MerchantShop | null; error: { message: string } | null }> {
  try {
    const localImageUri = isLocalImageUri(data.image_url) ? data.image_url : null;
    const payload = { ...data, image_url: localImageUri ? undefined : data.image_url };
    const shop = await apiClient.put<MerchantShop>(`/api/v1/merchant/shops/${shopId}`, payload);

    let imageUrl = shop.image_url;
    if (localImageUri) {
      const upload = await uploadBinaryToMerchantEndpoint(
        `/api/v1/merchant/shops/${shopId}/image`,
        localImageUri,
        `shop-${shopId}`
      );
      if (!upload.error && upload.url) {
        imageUrl = upload.url;
      }
    }

    return {
      shop: normalizeShopImageUrl({
        ...shop,
        image_url: imageUrl,
        ...merchantShopKpisFromApi(shop),
      }),
      error: null,
    };
  } catch (error) {
    return { shop: null, error: { message: toApiError(error).message } };
  }
}

// Get all shops for a merchant
export async function getMerchantShops(
  _userId: string
): Promise<{ shops: MerchantShop[]; error: { message: string } | null }> {
  try {
    await getCurrentUser();
    const shops = await apiClient.get<MerchantShop[]>('/api/v1/merchant/shops');
    const shopsWithStats = (shops || []).map((shop) => ({
      ...shop,
      image_url: toAbsoluteBackendUrl(shop.image_url),
      ...merchantShopKpisFromApi(shop),
    }));
    return { shops: shopsWithStats, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 401) {
      return { shops: [], error: null };
    }
    return { shops: [], error: { message: apiError.message } };
  }
}

// Delete a shop
export async function deleteShop(
  shopId: string,
  _userId: string
): Promise<{ error: { message: string } | null }> {
  try {
    await apiClient.delete(`/api/v1/merchant/shops/${shopId}`);
    return { error: null };
  } catch (error) {
    return { error: { message: toApiError(error).message } };
  }
}

