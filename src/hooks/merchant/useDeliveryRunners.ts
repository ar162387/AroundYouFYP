import { useMutation, useQuery, useQueryClient } from 'react-query';

import type { DeliveryRunner, DeliveryRunnerPayload } from '../../services/merchant/deliveryRunnerService';
import {
  createDeliveryRunner,
  deleteDeliveryRunner,
  fetchDeliveryRunners,
  updateDeliveryRunner,
} from '../../services/merchant/deliveryRunnerService';

export function useDeliveryRunners(shopId: string) {
  return useQuery(['delivery-runners', shopId], async () => {
    const { data, error } = await fetchDeliveryRunners(shopId);
    if (error) {
      throw error;
    }
    return data ?? [];
  }, {
    enabled: Boolean(shopId),
  });
}

export function useCreateDeliveryRunner(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(async (payload: DeliveryRunnerPayload) => {
    const { data, error } = await createDeliveryRunner(shopId, payload);
    if (error) {
      throw error;
    }
    return data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-runners', shopId] });
    },
  });
}

export function useUpdateDeliveryRunner(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(async ({ runnerId, payload }: { runnerId: string; payload: DeliveryRunnerPayload }) => {
    const { data, error } = await updateDeliveryRunner(runnerId, payload);
    if (error) {
      throw error;
    }
    return data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-runners', shopId] });
    },
  });
}

export function useDeleteDeliveryRunner(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(async (runnerId: string) => {
    const { error } = await deleteDeliveryRunner(runnerId);
    if (error) {
      throw error;
    }
    return runnerId;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-runners', shopId] });
    },
  });
}

