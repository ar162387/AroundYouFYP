import type { PostgrestError } from '@supabase/supabase-js';

import { loogin } from '../../lib/loogin';
import { supabase } from '../supabase';
import type { DeliveryArea, DeliveryAreaPayload, LatLngLiteral } from '../../types/delivery';

const log = loogin.scope('deliveryAreaService');

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

const TABLE = 'shop_delivery_areas';
const VIEW = 'shop_delivery_areas_view';

function parsePolygonCoordinates(raw: any): LatLngLiteral[] {
  if (!raw) {
    return [];
  }

  let geojson: any;

  try {
    geojson = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    log.error('Failed to parse polygon geometry', { raw });
    return [];
  }

  if (geojson?.type !== 'Polygon' || !Array.isArray(geojson.coordinates?.[0])) {
    return [];
  }

  const ring = geojson.coordinates[0];
  if (!Array.isArray(ring) || ring.length === 0) {
    return [];
  }

  const coordinates = ring.map((pair: any) => {
    const [longitude, latitude] = pair ?? [];
    return { latitude: Number(latitude), longitude: Number(longitude) };
  });

  // Drop the closing vertex if it duplicates the first
  if (coordinates.length > 1) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first.latitude === last.latitude && first.longitude === last.longitude) {
      coordinates.pop();
    }
  }

  return coordinates.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

function closeRing(coordinates: LatLngLiteral[]): LatLngLiteral[] {
  if (coordinates.length === 0) {
    return coordinates;
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (first.latitude === last.latitude && first.longitude === last.longitude) {
    return coordinates;
  }

  return [...coordinates, { ...first }];
}

function polygonToWkt(coordinates: LatLngLiteral[]): string {
  if (!Array.isArray(coordinates)) {
    throw new Error('Delivery areas need at least three points.');
  }

  const sanitized = coordinates
    .map(({ latitude, longitude }) => ({ latitude: Number(latitude), longitude: Number(longitude) }))
    .filter(({ latitude, longitude }) => Number.isFinite(latitude) && Number.isFinite(longitude));

  if (sanitized.length < 3) {
    throw new Error('Delivery areas need at least three valid points.');
  }

  const closed = closeRing(sanitized);
  const points = closed.map(({ latitude, longitude }) => `${longitude} ${latitude}`);
  return `SRID=4326;POLYGON((${points.join(', ')}))`;
}

function mapRow(row: any): DeliveryArea {
  return {
    id: row.id,
    shopId: row.shop_id,
    label: row.label ?? 'Delivery area',
    coordinates: parsePolygonCoordinates(row.geom_geojson ?? row.geom),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchDeliveryAreas(shopId: string): Promise<ServiceResult<DeliveryArea[]>> {
  log.debug('fetchDeliveryAreas', { shopId });

  const { data, error } = await supabase
    .from(VIEW)
    .select('id, shop_id, label, geom_geojson, created_at, updated_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: true });

  if (error) {
    log.error('Failed to fetch delivery areas', error);
    return { data: null, error };
  }

  const mapped = (data ?? []).map(mapRow);
  return { data: mapped, error: null };
}

export async function saveDeliveryAreas(shopId: string, payload: DeliveryAreaPayload[]): Promise<ServiceResult<DeliveryArea[]>> {
  log.debug('saveDeliveryAreas', { shopId, polygonCount: payload.length });

  const deleteResult = await supabase.from(TABLE).delete().eq('shop_id', shopId);

  if (deleteResult.error) {
    log.error('Failed to clear existing delivery areas', deleteResult.error);
    return { data: null, error: deleteResult.error };
  }

  if (payload.length === 0) {
    return { data: [], error: null };
  }

  let insertPayload: { shop_id: string; label: string | null; geom: string }[];

  try {
    insertPayload = payload.map((area) => ({
      shop_id: shopId,
      label: area.label ?? null,
      geom: polygonToWkt(area.coordinates),
    }));
  } catch (conversionError: any) {
    log.error('Failed to convert delivery area polygon to WKT', conversionError);
    const syntheticError: PostgrestError = {
      name: 'ClientConversionError',
      code: 'client_conversion_error',
      message: conversionError?.message ?? 'Invalid polygon coordinates.',
      details: '',
      hint: '',
    };
    return {
      data: null,
      error: syntheticError,
    };
  }

  const { error } = await supabase.from(TABLE).insert(insertPayload);

  if (error) {
    log.error('Failed to save delivery areas', error);
    return { data: null, error };
  }

  const { data: refreshedData, error: refreshedError } = await supabase
    .from(VIEW)
    .select('id, shop_id, label, geom_geojson, created_at, updated_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: true });

  if (refreshedError) {
    log.error('Failed to fetch delivery areas after save', refreshedError);
    return { data: null, error: refreshedError };
  }

  const mapped = (refreshedData ?? []).map(mapRow);
  return { data: mapped, error: null };
}

export async function deleteDeliveryArea(areaId: string): Promise<ServiceResult<null>> {
  log.debug('deleteDeliveryArea', { areaId });

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', areaId);

  if (error) {
    log.error('Failed to delete delivery area', error);
    return { data: null, error };
  }

  return { data: null, error: null };
}

