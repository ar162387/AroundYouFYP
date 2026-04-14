import { loogin } from '../../lib/loogin';
import { apiClient, toApiError } from '../apiClient';

const log = loogin.scope('deliveryLogicService');

type ServiceResult<T> = { data: T | null; error: any | null };

const TABLE = 'shop_delivery_logic';
const logicIdToShopId = new Map<string, string>();

export type DistanceTier = {
  max_distance: number; // in meters
  fee: number; // in PKR
};

export type DeliveryLogic = {
  id: string;
  shopId: string;
  // Order Value Layer
  minimumOrderValue: number;
  smallOrderSurcharge: number;
  leastOrderValue: number;
  // Distance Layer
  distanceMode: 'auto' | 'custom';
  maxDeliveryFee: number;
  distanceTiers: DistanceTier[];
  beyondTierFeePerUnit: number;
  beyondTierDistanceUnit: number;
  // Free Delivery Discount Layer
  freeDeliveryThreshold: number;
  freeDeliveryRadius: number;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryLogicPayload = {
  minimumOrderValue: number;
  smallOrderSurcharge: number;
  leastOrderValue: number;
  distanceMode?: 'auto' | 'custom';
  maxDeliveryFee?: number;
  distanceTiers?: DistanceTier[];
  beyondTierFeePerUnit?: number;
  beyondTierDistanceUnit?: number;
  freeDeliveryThreshold?: number;
  freeDeliveryRadius?: number;
};

const DEFAULT_DISTANCE_TIERS: DistanceTier[] = [
  { max_distance: 200, fee: 20 },
  { max_distance: 400, fee: 30 },
  { max_distance: 600, fee: 40 },
  { max_distance: 800, fee: 50 },
  { max_distance: 1000, fee: 60 },
];

function mapRow(row: any): DeliveryLogic {
  if (row.id && row.shop_id) {
    logicIdToShopId.set(row.id, row.shop_id);
  }
  // Ensure distanceTiers is always an array
  let distanceTiers = DEFAULT_DISTANCE_TIERS;
  if (row.distance_tiers) {
    if (Array.isArray(row.distance_tiers)) {
      distanceTiers = row.distance_tiers;
    } else {
      // If it's a string, try to parse it
      try {
        distanceTiers = typeof row.distance_tiers === 'string' 
          ? JSON.parse(row.distance_tiers) 
          : DEFAULT_DISTANCE_TIERS;
      } catch {
        distanceTiers = DEFAULT_DISTANCE_TIERS;
      }
    }
  }

  return {
    id: row.id,
    shopId: row.shop_id,
    minimumOrderValue: Number(row.minimum_order_value),
    smallOrderSurcharge: Number(row.small_order_surcharge),
    leastOrderValue: Number(row.least_order_value),
    distanceMode: row.distance_mode || 'auto',
    maxDeliveryFee: Number(row.max_delivery_fee || 130),
    distanceTiers,
    beyondTierFeePerUnit: Number(row.beyond_tier_fee_per_unit || 10),
    beyondTierDistanceUnit: Number(row.beyond_tier_distance_unit || 250),
    freeDeliveryThreshold: Number(row.free_delivery_threshold || 800),
    freeDeliveryRadius: Number(row.free_delivery_radius || 1000),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchDeliveryLogicFromConsumerShop(
  shopId: string
): Promise<ServiceResult<DeliveryLogic | null>> {
  try {
    // Consumer endpoint exposes delivery logic as part of shop details and does not require merchant role.
    const detail = await apiClient.get<any>(`/api/v1/consumer/shops/${shopId}`, {
      requiresAuth: false,
    });
    const delivery = detail?.delivery_logic || detail?.deliveryLogic;
    if (!delivery) {
      return { data: null, error: null };
    }

    const normalizedRow = {
      ...delivery,
      shop_id: delivery.shop_id || delivery.shopId || shopId,
    };
    return { data: mapRow(normalizedRow), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 404) {
      return { data: null, error: null };
    }
    return { data: null, error: apiError };
  }
}

export async function fetchDeliveryLogic(shopId: string): Promise<ServiceResult<DeliveryLogic | null>> {
  try {
    const data = await apiClient.get<any>(`/api/v1/merchant/shops/${shopId}/delivery-logic`);
    if (!data) {
      return { data: null, error: null };
    }

    return { data: mapRow(data), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 404) {
      return { data: null, error: null };
    }
    if (apiError.status === 401 || apiError.status === 403) {
      const fallbackResult = await fetchDeliveryLogicFromConsumerShop(shopId);
      if (fallbackResult.data || !fallbackResult.error) {
        return fallbackResult;
      }
    }
    log.error('Exception fetching delivery logic:', error);
    return { data: null, error: apiError };
  }
}

/**
 * Batch fetch delivery logic for multiple shops in a single query
 * More efficient than calling fetchDeliveryLogic individually for each shop
 */
export async function fetchDeliveryLogicBatch(
  shopIds: string[]
): Promise<Map<string, DeliveryLogic | null>> {
  const resultMap = new Map<string, DeliveryLogic | null>();

  if (shopIds.length === 0) {
    return resultMap;
  }

  await Promise.all(
    shopIds.map(async (shopId) => {
      const { data } = await fetchDeliveryLogic(shopId);
      resultMap.set(shopId, data || null);
    })
  );
  return resultMap;
}

export async function createDeliveryLogic(
  shopId: string,
  payload: DeliveryLogicPayload
): Promise<ServiceResult<DeliveryLogic>> {
  log.debug('createDeliveryLogic', { shopId, payload });

  const insertData: any = {
    minimum_order_value: payload.minimumOrderValue,
    small_order_surcharge: payload.smallOrderSurcharge,
    least_order_value: payload.leastOrderValue,
  };

  // Add distance layer fields if provided
  if (payload.distanceMode) insertData.distance_mode = payload.distanceMode;
  if (payload.maxDeliveryFee !== undefined) insertData.max_delivery_fee = payload.maxDeliveryFee;
  if (payload.distanceTiers) insertData.distance_tiers = payload.distanceTiers; // Supabase handles JSONB automatically
  if (payload.beyondTierFeePerUnit !== undefined) insertData.beyond_tier_fee_per_unit = payload.beyondTierFeePerUnit;
  if (payload.beyondTierDistanceUnit !== undefined) insertData.beyond_tier_distance_unit = payload.beyondTierDistanceUnit;
  if (payload.freeDeliveryThreshold !== undefined) insertData.free_delivery_threshold = payload.freeDeliveryThreshold;
  if (payload.freeDeliveryRadius !== undefined) insertData.free_delivery_radius = payload.freeDeliveryRadius;

  try {
    const data = await apiClient.put<any>(`/api/v1/merchant/shops/${shopId}/delivery-logic`, insertData);
    return { data: mapRow(data), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to create delivery logic', apiError);
    return { data: null, error: apiError };
  }
}

export async function updateDeliveryLogic(
  logicId: string,
  payload: DeliveryLogicPayload
): Promise<ServiceResult<DeliveryLogic>> {
  log.debug('updateDeliveryLogic', { logicId, payload });
  const shopId = logicIdToShopId.get(logicId);
  if (!shopId) {
    const missingError: any = {
      name: 'ShopLookupError',
      code: 'shop_lookup_failed',
      message: 'Unable to resolve shop for delivery logic update.',
      details: '',
      hint: '',
    };
    return { data: null, error: missingError };
  }

  const updateData: any = {
    minimum_order_value: payload.minimumOrderValue,
    small_order_surcharge: payload.smallOrderSurcharge,
    least_order_value: payload.leastOrderValue,
  };

  // Add distance layer fields if provided
  if (payload.distanceMode) updateData.distance_mode = payload.distanceMode;
  if (payload.maxDeliveryFee !== undefined) updateData.max_delivery_fee = payload.maxDeliveryFee;
  if (payload.distanceTiers) updateData.distance_tiers = payload.distanceTiers; // Supabase handles JSONB automatically
  if (payload.beyondTierFeePerUnit !== undefined) updateData.beyond_tier_fee_per_unit = payload.beyondTierFeePerUnit;
  if (payload.beyondTierDistanceUnit !== undefined) updateData.beyond_tier_distance_unit = payload.beyondTierDistanceUnit;
  if (payload.freeDeliveryThreshold !== undefined) updateData.free_delivery_threshold = payload.freeDeliveryThreshold;
  if (payload.freeDeliveryRadius !== undefined) updateData.free_delivery_radius = payload.freeDeliveryRadius;

  try {
    const data = await apiClient.put<any>(`/api/v1/merchant/shops/${shopId}/delivery-logic`, updateData);
    return { data: mapRow(data), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to update delivery logic', apiError);
    return { data: null, error: apiError };
  }
}

// Helper function to calculate order surcharge based on order value
export function calculateOrderSurcharge(orderValue: number, logic: DeliveryLogic): number {
  if (orderValue < logic.minimumOrderValue) {
    return logic.smallOrderSurcharge;
  }
  return 0;
}

// Helper function to validate if order meets minimum requirements
export function validateOrderValue(orderValue: number, logic: DeliveryLogic): {
  valid: boolean;
  message?: string;
} {
  if (orderValue < logic.leastOrderValue) {
    return {
      valid: false,
      message: `Minimum item value is Rs ${logic.leastOrderValue.toFixed(0)}`,
    };
  }
  return { valid: true };
}

// Helper function to calculate straight-line distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Helper function to calculate delivery fee based on distance
// Uses distance tiering (auto or custom) and falls back to maximum if it exceeds all tiers
export function calculateDeliveryFee(
  distanceInMeters: number,
  logic: DeliveryLogic
): number {
  // Ensure we have valid tiers
  if (!logic.distanceTiers || logic.distanceTiers.length === 0) {
    // Fallback to maximum delivery fee if no tiers configured
    return logic.maxDeliveryFee;
  }

  // Sort tiers by max_distance (ascending) to ensure proper tier matching
  const tiers = [...logic.distanceTiers].sort((a, b) => a.max_distance - b.max_distance);
  
  // Find matching tier - check each tier in order
  for (const tier of tiers) {
    if (distanceInMeters <= tier.max_distance) {
      // Found matching tier - return fee capped at maxDeliveryFee
      return Math.min(tier.fee, logic.maxDeliveryFee);
    }
  }

  // Beyond all tiers - calculate extra fee based on beyond tier rules
  const lastTier = tiers[tiers.length - 1];
  const extraDistance = distanceInMeters - lastTier.max_distance;
  const extraUnits = Math.ceil(extraDistance / logic.beyondTierDistanceUnit);
  const totalFee = lastTier.fee + (extraUnits * logic.beyondTierFeePerUnit);

  // Cap at maximum delivery fee (fallback to max if exceeds all tier rules)
  return Math.min(totalFee, logic.maxDeliveryFee);
}

// Helper function to check if order qualifies for free delivery
export function checkFreeDelivery(
  orderValue: number,
  distanceInMeters: number,
  logic: DeliveryLogic
): boolean {
  return (
    orderValue >= logic.freeDeliveryThreshold &&
    distanceInMeters <= logic.freeDeliveryRadius
  );
}

// Complete delivery fee calculation with all layers applied
export function calculateTotalDeliveryFee(
  orderValue: number,
  distanceInMeters: number,
  logic: DeliveryLogic
): {
  baseFee: number;
  surcharge: number;
  freeDeliveryApplied: boolean;
  finalFee: number;
} {
  // Check free delivery first
  const freeDeliveryApplied = checkFreeDelivery(orderValue, distanceInMeters, logic);
  
  if (freeDeliveryApplied) {
    return {
      baseFee: 0,
      surcharge: 0,
      freeDeliveryApplied: true,
      finalFee: 0,
    };
  }

  // Calculate base delivery fee from distance
  const baseFee = calculateDeliveryFee(distanceInMeters, logic);

  // Calculate order value surcharge
  const surcharge = calculateOrderSurcharge(orderValue, logic);

  return {
    baseFee,
    surcharge,
    freeDeliveryApplied: false,
    finalFee: baseFee + surcharge,
  };
}

