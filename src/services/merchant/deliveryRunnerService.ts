import type { PostgrestError } from '@supabase/supabase-js';

import { loogin } from '../../lib/loogin';
import { supabase } from '../supabase';

const log = loogin.scope('deliveryRunnerService');

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

const TABLE = 'delivery_runners';

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

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, shop_id, name, phone_number, created_at, updated_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: true });

  if (error) {
    log.error('Failed to fetch delivery runners', error);
    return { data: null, error };
  }

  const mapped = (data ?? []).map(mapRow);
  return { data: mapped, error: null };
}

export async function createDeliveryRunner(
  shopId: string,
  payload: DeliveryRunnerPayload
): Promise<ServiceResult<DeliveryRunner>> {
  log.debug('createDeliveryRunner', { shopId, name: payload.name });

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      shop_id: shopId,
      name: payload.name,
      phone_number: payload.phoneNumber,
    })
    .select('id, shop_id, name, phone_number, created_at, updated_at')
    .single();

  if (error) {
    log.error('Failed to create delivery runner', error);
    return { data: null, error };
  }

  return { data: mapRow(data), error: null };
}

export async function updateDeliveryRunner(
  runnerId: string,
  payload: DeliveryRunnerPayload
): Promise<ServiceResult<DeliveryRunner>> {
  log.debug('updateDeliveryRunner', { runnerId, name: payload.name });

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name: payload.name,
      phone_number: payload.phoneNumber,
    })
    .eq('id', runnerId)
    .select('id, shop_id, name, phone_number, created_at, updated_at')
    .single();

  if (error) {
    log.error('Failed to update delivery runner', error);
    return { data: null, error };
  }

  return { data: mapRow(data), error: null };
}

export async function deleteDeliveryRunner(runnerId: string): Promise<ServiceResult<null>> {
  log.debug('deleteDeliveryRunner', { runnerId });

  // Check if there are any ACTIVE orders (out_for_delivery) with this runner
  // These are truly active and should prevent deletion
  const { data: activeOrders, error: activeCheckError } = await supabase
    .from('orders')
    .select('id, order_number, status')
    .eq('delivery_runner_id', runnerId)
    .eq('status', 'out_for_delivery');

  if (activeCheckError) {
    log.error('Failed to check active orders', activeCheckError);
    return { data: null, error: activeCheckError };
  }

  if (activeOrders && activeOrders.length > 0) {
    const errorMessage = `Cannot delete delivery runner. There are ${activeOrders.length} active order(s) currently out for delivery assigned to this runner. Please wait until these orders are delivered or reassign them to another runner.`;
    log.error('Cannot delete runner with active orders', { runnerId, activeOrdersCount: activeOrders.length });
    const syntheticError: PostgrestError = {
      name: 'PostgrestError',
      code: '23514',
      message: errorMessage,
      details: '',
      hint: '',
    };
    return {
      data: null,
      error: syntheticError,
    };
  }

  // Set delivery_runner_id to NULL for all orders (delivered, pending, confirmed, cancelled)
  // Delivered orders can now have NULL runner_id due to the updated constraint
  const { error: updateError } = await supabase
    .from('orders')
    .update({ delivery_runner_id: null })
    .eq('delivery_runner_id', runnerId);

  if (updateError) {
    log.error('Failed to update orders before deleting runner', updateError);
    return { data: null, error: updateError };
  }

  // Now safe to delete the runner
  const { error } = await supabase.from(TABLE).delete().eq('id', runnerId);

  if (error) {
    log.error('Failed to delete delivery runner', error);
    return { data: null, error };
  }

  return { data: null, error: null };
}

