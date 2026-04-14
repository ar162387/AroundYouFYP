import { loogin } from '../../lib/loogin';
import { apiClient, toApiError } from '../apiClient';
import type { DeliveryArea, DeliveryAreaPayload } from '../../types/delivery';

const log = loogin.scope('deliveryAreaService');
type ServiceResult<T> = { data: T | null; error: any | null };
const areaIdToShopId = new Map<string, string>();

function mapRow(row: any): DeliveryArea {
  if (row.id && row.shop_id) {
    areaIdToShopId.set(row.id, row.shop_id);
  }
  return {
    id: row.id,
    shopId: row.shop_id,
    label: row.label ?? 'Delivery area',
    coordinates: row.coordinates || row.geom_geojson || row.geom || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchDeliveryAreas(shopId: string): Promise<ServiceResult<DeliveryArea[]>> {
  try {
    const data = await apiClient.get<any[]>(`/api/v1/merchant/shops/${shopId}/delivery-areas`);
    return { data: (data || []).map(mapRow), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to fetch delivery areas', apiError);
    return { data: null, error: apiError };
  }
}

export async function saveDeliveryAreas(
  shopId: string,
  payload: DeliveryAreaPayload[]
): Promise<ServiceResult<DeliveryArea[]>> {
  try {
    const existing = await fetchDeliveryAreas(shopId);
    if (existing.error) return { data: null, error: existing.error };

    await Promise.all(
      (existing.data || []).map((area) =>
        apiClient.delete(`/api/v1/merchant/shops/${shopId}/delivery-areas/${area.id}`)
      )
    );

    for (const area of payload) {
      await apiClient.post(`/api/v1/merchant/shops/${shopId}/delivery-areas`, {
        label: area.label ?? null,
        coordinates: area.coordinates,
      });
    }

    return fetchDeliveryAreas(shopId);
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to save delivery areas', apiError);
    return { data: null, error: apiError };
  }
}

export async function deleteDeliveryArea(areaId: string): Promise<ServiceResult<null>> {
  const shopId = areaIdToShopId.get(areaId);
  if (!shopId) {
    return {
      data: null,
      error: {
        name: 'AreaLookupError',
        code: 'area_lookup_failed',
        message: 'Unable to resolve delivery area context.',
        details: '',
        hint: '',
      },
    };
  }
  try {
    await apiClient.delete(`/api/v1/merchant/shops/${shopId}/delivery-areas/${areaId}`);
    return { data: null, error: null };
  } catch (error) {
    return { data: null, error: toApiError(error) };
  }
}

