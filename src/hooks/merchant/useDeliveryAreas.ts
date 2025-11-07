import { useMutation, useQuery, useQueryClient } from 'react-query';

import type { DeliveryArea, DeliveryAreaPayload } from '../../types/delivery';
import { deleteDeliveryArea, fetchDeliveryAreas, saveDeliveryAreas } from '../../services/merchant/deliveryAreaService';

export function useDeliveryAreas(shopId: string) {
  return useQuery(['delivery-areas', shopId], async () => {
    const { data, error } = await fetchDeliveryAreas(shopId);
    if (error) {
      throw error;
    }
    return data ?? [];
  }, {
    enabled: Boolean(shopId),
  });
}

export function useSaveDeliveryAreas(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(async (areas: DeliveryAreaPayload[]) => {
    const { data, error } = await saveDeliveryAreas(shopId, areas);
    if (error) {
      throw error;
    }
    return data ?? [];
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-areas', shopId] });
    },
  });
}

export function useDeleteDeliveryArea(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(async (areaId: string) => {
    const { error } = await deleteDeliveryArea(areaId);
    if (error) {
      throw error;
    }
    return areaId;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-areas', shopId] });
    },
  });
}

