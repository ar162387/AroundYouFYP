import type { DeliveryLogic } from '../merchant/deliveryLogicService';
import { ApiError, apiClient, toApiError } from '../apiClient';
import Config from 'react-native-config';

export type ConsumerShop = {
  id: string;
  name: string;
  image_url: string;
  rating: number;
  orders?: number;
  delivery_fee: number;
  delivery_time?: string;
  tags: string[];
  address: string;
  latitude?: number;
  longitude?: number;
  is_open: boolean;
  created_at: string;
  shop_type?: string;
  minimumOrderValue?: number;
  opening_hours?: any;
  holidays?: any;
  open_status_mode?: 'auto' | 'manual_open' | 'manual_closed' | null;
};

export type ShopDetails = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  address: string;
  latitude: number;
  longitude: number;
  tags: string[];
  is_open: boolean;
  rating: number;
  orders: number;
  deliveryLogic: DeliveryLogic | null;
  opening_hours?: any; // OpeningHoursConfig
  holidays?: any; // ShopHoliday[]
  open_status_mode?: 'auto' | 'manual_open' | 'manual_closed' | null;
};

export type ShopCategory = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type ShopItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
  categories: string[];
};

type ServiceResult<T> = { data: T | null; error: ApiError | null };

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

/**
 * Find shops that have delivery areas containing the given point
 * Uses PostGIS ST_Contains to check if the point is within any delivery area polygon
 */
export async function findShopsByLocation(
  latitude: number,
  longitude: number
): Promise<ServiceResult<ConsumerShop[]>> {
  try {
    const data = await apiClient.get<ConsumerShop[]>(
      `/api/v1/consumer/shops?lat=${latitude}&lon=${longitude}`
    );
    const normalized = (data || []).map((shop) => ({
      ...shop,
      image_url: toAbsoluteBackendUrl(shop.image_url) || '',
    }));
    return { data: normalized, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}


/**
 * Fetch detailed shop information including delivery logic
 */
export async function fetchShopDetails(shopId: string): Promise<ServiceResult<ShopDetails>> {
  try {
    const detail = await apiClient.get<any>(`/api/v1/consumer/shops/${shopId}`);
    const delivery = detail.delivery_logic || detail.deliveryLogic || null;
    const rawTiers = delivery
      ? delivery.distance_tiers || delivery.distanceTiers || []
      : [];
    const normalizedTiers = Array.isArray(rawTiers)
      ? rawTiers.map((t: any) => ({
          max_distance: Number(t.max_distance ?? t.maxDistance ?? 0),
          fee: Number(t.fee ?? 0),
        }))
      : [];
    const deliveryLogic: DeliveryLogic | null = delivery
      ? {
          id: delivery.id,
          shopId: delivery.shop_id || delivery.shopId,
          minimumOrderValue: Number(delivery.minimum_order_value || delivery.minimumOrderValue || 0),
          smallOrderSurcharge: Number(delivery.small_order_surcharge || delivery.smallOrderSurcharge || 0),
          leastOrderValue: Number(delivery.least_order_value || delivery.leastOrderValue || 0),
          distanceMode: delivery.distance_mode || delivery.distanceMode || 'auto',
          maxDeliveryFee: Number(delivery.max_delivery_fee || delivery.maxDeliveryFee || 130),
          distanceTiers: normalizedTiers,
          beyondTierFeePerUnit: Number(delivery.beyond_tier_fee_per_unit || delivery.beyondTierFeePerUnit || 10),
          beyondTierDistanceUnit: Number(
            delivery.beyond_tier_distance_unit || delivery.beyondTierDistanceUnit || 250
          ),
          freeDeliveryThreshold: Number(delivery.free_delivery_threshold || delivery.freeDeliveryThreshold || 800),
          freeDeliveryRadius: Number(delivery.free_delivery_radius || delivery.freeDeliveryRadius || 1000),
          createdAt: delivery.created_at || delivery.createdAt,
          updatedAt: delivery.updated_at || delivery.updatedAt,
        }
      : null;

    return {
      data: {
        id: detail.id,
        name: detail.name,
        description: detail.description,
        image_url: toAbsoluteBackendUrl(detail.image_url),
        address: detail.address,
        latitude: detail.latitude,
        longitude: detail.longitude,
        tags: detail.tags || [],
        is_open: detail.is_open,
        rating: detail.rating || 0,
        orders: detail.review_count || detail.orders || 0,
        deliveryLogic,
        opening_hours: detail.opening_hours,
        holidays: detail.holidays,
        open_status_mode: detail.open_status_mode,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

/**
 * Fetch active categories for a shop
 */
export async function fetchShopCategories(shopId: string): Promise<ServiceResult<ShopCategory[]>> {
  try {
    const detail = await apiClient.get<any>(`/api/v1/consumer/shops/${shopId}`);
    const categories: ShopCategory[] = (detail.categories || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || null,
      is_active: true,
    }));
    return { data: categories, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

/**
 * Fetch items for a shop, optionally filtered by category
 */
export async function fetchShopItems(
  shopId: string,
  categoryId?: string,
  searchQuery?: string
): Promise<ServiceResult<ShopItem[]>> {
  try {
    const detail = await apiClient.get<any>(`/api/v1/consumer/shops/${shopId}`);
    let items: ShopItem[] = [];
    (detail.categories || []).forEach((category: any) => {
      (category.items || []).forEach((item: any) => {
        items.push({
          id: item.id,
          name: item.name,
          description: item.description || null,
          image_url: toAbsoluteBackendUrl(item.image_url || null),
          price_cents: item.price_cents,
          currency: item.currency || 'PKR',
          is_active: item.is_active !== false,
          categories: [category.id],
        });
      });
    });

    if (categoryId) {
      items = items.filter((item) => item.categories.includes(categoryId));
    }
    if (searchQuery?.trim()) {
      const term = searchQuery.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(term));
    }

    return { data: items, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

export type CartValidationResult = {
  valid: boolean;
  meetsMinimumOrder: boolean;
  leastOrderValue: number | null;
  currentOrderValue: number;
  message?: string;
};

/**
 * Validate cart against shop's current minimum order requirements
 * This queries the database to get the latest leastOrderValue, ensuring
 * real-time validation even if merchant changes settings
 */
export async function validateCartOrderValue(
  shopId: string,
  orderValueCents: number
): Promise<ServiceResult<CartValidationResult>> {
  try {
    const detail = await fetchShopDetails(shopId);
    if (detail.error || !detail.data) {
      return { data: null, error: detail.error };
    }
    const leastOrderValue = detail.data.deliveryLogic?.leastOrderValue ?? 0;
    const orderValuePKR = orderValueCents / 100;
    const meetsMinimumOrder = orderValuePKR >= leastOrderValue;

    return {
      data: {
        valid: meetsMinimumOrder,
        meetsMinimumOrder,
        leastOrderValue,
        currentOrderValue: orderValuePKR,
        message: meetsMinimumOrder 
          ? undefined 
          : `Minimum order value is Rs ${leastOrderValue.toFixed(0)}`,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

/**
 * Check if a delivery address is within a shop's delivery zone
 * Uses PostGIS ST_Contains to verify the point is within the delivery polygon
 */
export async function validateDeliveryAddress(
  shopId: string,
  latitude: number,
  longitude: number
): Promise<ServiceResult<{ isWithinDeliveryZone: boolean }>> {
  try {
    const shops = await findShopsByLocation(latitude, longitude);
    if (shops.error) return { data: null, error: shops.error };
    const isWithinDeliveryZone = (shops.data || []).some((shop) => shop.id === shopId);
    return {
      data: { isWithinDeliveryZone },
      error: null,
    };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

