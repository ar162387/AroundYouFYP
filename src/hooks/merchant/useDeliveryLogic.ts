import { useMutation, useQuery, useQueryClient } from 'react-query';

import type { DeliveryLogic, DeliveryLogicPayload } from '../../services/merchant/deliveryLogicService';
import { createDeliveryLogic, fetchDeliveryLogic, updateDeliveryLogic } from '../../services/merchant/deliveryLogicService';

export function useDeliveryLogic(shopId: string) {
  return useQuery(['delivery-logic', shopId], async () => {
    const { data, error } = await fetchDeliveryLogic(shopId);
    if (error) {
      throw error;
    }
    // Return default values if no logic exists yet
    if (!data) {
      return {
        id: '',
        shopId,
        minimumOrderValue: 200,
        smallOrderSurcharge: 40,
        leastOrderValue: 100,
        distanceMode: 'auto' as const,
        maxDeliveryFee: 130,
        distanceTiers: [
          { max_distance: 200, fee: 20 },
          { max_distance: 400, fee: 30 },
          { max_distance: 600, fee: 40 },
          { max_distance: 800, fee: 50 },
          { max_distance: 1000, fee: 60 },
        ],
        beyondTierFeePerUnit: 10,
        beyondTierDistanceUnit: 250,
        freeDeliveryThreshold: 800,
        freeDeliveryRadius: 1000,
        createdAt: '',
        updatedAt: '',
      } as DeliveryLogic;
    }
    return data;
  }, {
    enabled: Boolean(shopId),
  });
}

export function useSaveDeliveryLogic(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(async (payload: DeliveryLogicPayload) => {
    // First check if delivery logic exists
    const { data: existing } = await fetchDeliveryLogic(shopId);
    
    if (existing) {
      const { data, error } = await updateDeliveryLogic(existing.id, payload);
      if (error) {
        throw error;
      }
      return data;
    } else {
      const { data, error } = await createDeliveryLogic(shopId, payload);
      if (error) {
        throw error;
      }
      return data;
    }
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-logic', shopId] });
    },
  });
}

