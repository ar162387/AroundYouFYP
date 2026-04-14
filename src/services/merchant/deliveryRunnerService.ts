import { loogin } from '../../lib/loogin';
import { apiClient, toApiError } from '../apiClient';

const log = loogin.scope('deliveryRunnerService');

type ServiceResult<T> = { data: T | null; error: any | null };

const TABLE = 'delivery_runners';
const runnerIdToShopId = new Map<string, string>();

export type DeliveryRunner = {
  id: string;
  shopId: string;
  name: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryRunnerPayload = {
  name: string;
  phoneNumber: string;
};

function mapRow(row: any): DeliveryRunner {
  if (row.id && row.shop_id) {
    runnerIdToShopId.set(row.id, row.shop_id);
  }
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    phoneNumber: row.phone_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchDeliveryRunners(shopId: string): Promise<ServiceResult<DeliveryRunner[]>> {
  log.debug('fetchDeliveryRunners', { shopId });

  try {
    const data = await apiClient.get<any[]>(`/api/v1/merchant/shops/${shopId}/runners`);
    const mapped = (data ?? []).map((row: any) => mapRow({ ...row, shop_id: row.shop_id || shopId }));
    return { data: mapped, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to fetch delivery runners', apiError);
    return { data: null, error: apiError };
  }
}

export async function createDeliveryRunner(
  shopId: string,
  payload: DeliveryRunnerPayload
): Promise<ServiceResult<DeliveryRunner>> {
  log.debug('createDeliveryRunner', { shopId, name: payload.name });

  try {
    const data = await apiClient.post<any>(`/api/v1/merchant/shops/${shopId}/runners`, {
      name: payload.name,
      phone_number: payload.phoneNumber,
    });
    return { data: mapRow(data), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to create delivery runner', apiError);
    return { data: null, error: apiError };
  }
}

export async function updateDeliveryRunner(
  runnerId: string,
  payload: DeliveryRunnerPayload
): Promise<ServiceResult<DeliveryRunner>> {
  log.debug('updateDeliveryRunner', { runnerId, name: payload.name });
  const shopId = runnerIdToShopId.get(runnerId);
  if (!shopId) {
    return {
      data: null,
      error: {
        name: 'RunnerLookupError',
        code: 'runner_lookup_failed',
        message: 'Unable to resolve runner shop context.',
        details: '',
        hint: '',
      },
    };
  }

  try {
    const data = await apiClient.put<any>(`/api/v1/merchant/shops/${shopId}/runners/${runnerId}`, {
      name: payload.name,
      phone_number: payload.phoneNumber,
    });
    return { data: mapRow(data), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}

export async function deleteDeliveryRunner(runnerId: string): Promise<ServiceResult<null>> {
  log.debug('deleteDeliveryRunner', { runnerId });
  try {
    const shopId = runnerIdToShopId.get(runnerId);
    if (!shopId) {
      return {
        data: null,
        error: {
          name: 'RunnerLookupError',
          code: 'runner_lookup_failed',
          message: 'Unable to resolve runner shop context.',
          details: '',
          hint: '',
        },
      };
    }
    await apiClient.delete(`/api/v1/merchant/shops/${shopId}/runners/${runnerId}`);
    return { data: null, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to delete delivery runner', apiError);
    return { data: null, error: apiError };
  }
}

