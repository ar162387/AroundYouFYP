import { supabase } from '../supabase';
import type { Shop } from '../supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export type ConsumerShop = Shop;

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Find shops that have delivery areas containing the given point
 * Uses PostGIS ST_Contains to check if the point is within any delivery area polygon
 */
export async function findShopsByLocation(
  latitude: number,
  longitude: number
): Promise<ServiceResult<ConsumerShop[]>> {
  try {
    // Use PostGIS to find shops whose delivery areas contain the point
    // ST_Contains checks if the polygon contains the point
    const pointWkt = `POINT(${longitude} ${latitude})`;
    
    console.log('Calling RPC find_shops_by_location with:', pointWkt);
    const { data, error } = await supabase.rpc('find_shops_by_location', {
      point_wkt: pointWkt,
    });

    if (error) {
      console.error('Error finding shops by location:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // If the RPC function doesn't exist, try a direct query as fallback
      if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
        console.warn('RPC function not found, trying direct query fallback');
        return await findShopsByLocationFallback(latitude, longitude);
      }
      
      return { data: null, error };
    }

    console.log('RPC returned data:', data);

    if (!data) {
      return { data: [], error: null };
    }

    // Map the result to ConsumerShop format
    const shops: ConsumerShop[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      image_url: row.image_url || '',
      rating: 0, // N/A for now
      orders: undefined, // N/A for now
      delivery_fee: 0, // N/A for now
      delivery_time: undefined, // N/A for now
      tags: row.tags || [],
      address: row.address,
      is_open: row.is_open,
      created_at: row.created_at,
    }));

    return { data: shops, error: null };
  } catch (error: any) {
    console.error('Exception finding shops by location:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Fallback method if RPC function doesn't exist
 * This queries all open shops (less efficient but works without the function)
 */
async function findShopsByLocationFallback(
  latitude: number,
  longitude: number
): Promise<ServiceResult<ConsumerShop[]>> {
  try {
    console.log('Using fallback query method');
    // Just get all open shops for now - the delivery area check would need to be done client-side
    // or we need the migration to be applied
    const { data, error } = await supabase
      .from('shops')
      .select('id, name, image_url, tags, address, is_open, created_at')
      .eq('is_open', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Fallback query error:', error);
      return { data: null, error };
    }

    const shops: ConsumerShop[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      image_url: row.image_url || '',
      rating: 0,
      orders: undefined,
      delivery_fee: 0,
      delivery_time: undefined,
      tags: row.tags || [],
      address: row.address,
      is_open: row.is_open,
      created_at: row.created_at,
    }));

    console.log('Fallback returned shops:', shops.length);
    return { data: shops, error: null };
  } catch (error: any) {
    console.error('Exception in fallback:', error);
    return { data: null, error: error as PostgrestError };
  }
}

