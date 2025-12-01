import { supabase, executeWithRetry, isTimeoutOrConnectionError, resetSupabaseConnection } from '../supabase';
import type { Shop } from '../supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type { DeliveryLogic } from '../merchant/deliveryLogicService';
import { getCurrentOpeningStatus } from '../../utils/shopOpeningHours';

export type ConsumerShop = Shop;

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
    
    // Use executeWithRetry to automatically handle timeout errors
    const result = await executeWithRetry(async (client) => {
      const { data, error } = await client.rpc('find_shops_by_location', {
        point_wkt: pointWkt,
      });
      return { data, error };
    });

    const { data, error } = result;

    if (error) {
      console.error('Error finding shops by location:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // If it's a timeout error even after retry, return it but log for monitoring
      if (isTimeoutOrConnectionError(error)) {
        console.error('Timeout error persisted after retry - connection may need manual reset');
      }
      
      return { data: null, error };
    }

    console.log('RPC returned data:', data);

    if (!data) {
      return { data: [], error: null };
    }

    // Map the result to ConsumerShop format and compute real-time opening status
    const shops: ConsumerShop[] = data.map((row: any) => {
      // Compute real-time opening status if opening hours data is available
      let computedIsOpen = row.is_open;
      if (row.opening_hours || row.holidays || row.open_status_mode) {
        const openingStatus = getCurrentOpeningStatus({
          opening_hours: row.opening_hours,
          holidays: row.holidays,
          open_status_mode: row.open_status_mode,
        });
        computedIsOpen = openingStatus.isOpen;
      }

      return {
        id: row.id,
        name: row.name,
        image_url: row.image_url || '',
        rating: 0, // N/A for now
        orders: row.delivered_orders_count !== undefined ? Number(row.delivered_orders_count) : 0,
        delivery_fee: 0, // Will be calculated based on distance and delivery logic
        delivery_time: undefined, // N/A for now
        tags: row.tags || [],
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        is_open: computedIsOpen, // Use computed real-time status
        created_at: row.created_at,
        shop_type: row.shop_type || undefined,
        minimumOrderValue: undefined, // Will be set by calculateShopsDeliveryFees
        opening_hours: row.opening_hours,
        holidays: row.holidays,
        open_status_mode: row.open_status_mode,
      };
    });

    return { data: shops, error: null };
  } catch (error: any) {
    console.error('Exception finding shops by location:', error);
    
    // Check if it's a timeout error and try to reset connection for future requests
    if (isTimeoutOrConnectionError(error)) {
      console.warn('Timeout exception detected, resetting connection for future requests...');
      resetSupabaseConnection().catch((resetError) => {
        console.error('Failed to reset connection after timeout exception:', resetError);
      });
    }
    
    return { data: null, error: error as PostgrestError };
  }
}


/**
 * Fetch detailed shop information including delivery logic
 */
export async function fetchShopDetails(shopId: string): Promise<ServiceResult<ShopDetails>> {
  try {
    // Fetch shop info including opening hours fields for real-time status
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('id, name, description, image_url, address, latitude, longitude, tags, is_open, opening_hours, holidays, open_status_mode')
      .eq('id', shopId)
      .single();

    if (shopError) {
      console.error('Error fetching shop details:', shopError);
      return { data: null, error: shopError };
    }

    if (!shopData) {
      return { data: null, error: null };
    }

    // Fetch delivery logic
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('shop_delivery_logic')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (deliveryError) {
      console.error('Error fetching delivery logic:', deliveryError);
    }

    // Fetch delivered orders count
    const { count: deliveredOrdersCount, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('status', 'delivered');

    if (ordersError) {
      console.error('Error fetching orders count:', ordersError);
    }

    // Map delivery logic if it exists
    let deliveryLogic: DeliveryLogic | null = null;
    if (deliveryData) {
      deliveryLogic = {
        id: deliveryData.id,
        shopId: deliveryData.shop_id,
        minimumOrderValue: Number(deliveryData.minimum_order_value),
        smallOrderSurcharge: Number(deliveryData.small_order_surcharge),
        leastOrderValue: Number(deliveryData.least_order_value),
        distanceMode: deliveryData.distance_mode || 'auto',
        maxDeliveryFee: Number(deliveryData.max_delivery_fee || 130),
        distanceTiers: deliveryData.distance_tiers || [],
        beyondTierFeePerUnit: Number(deliveryData.beyond_tier_fee_per_unit || 10),
        beyondTierDistanceUnit: Number(deliveryData.beyond_tier_distance_unit || 250),
        freeDeliveryThreshold: Number(deliveryData.free_delivery_threshold || 800),
        freeDeliveryRadius: Number(deliveryData.free_delivery_radius || 1000),
        createdAt: deliveryData.created_at,
        updatedAt: deliveryData.updated_at,
      };
    }

    // Compute real-time opening status
    const openingStatus = getCurrentOpeningStatus({
      opening_hours: shopData.opening_hours as any,
      holidays: shopData.holidays as any,
      open_status_mode: shopData.open_status_mode as any,
    });

    const shopDetails: ShopDetails = {
      id: shopData.id,
      name: shopData.name,
      description: shopData.description,
      image_url: shopData.image_url,
      address: shopData.address,
      latitude: shopData.latitude,
      longitude: shopData.longitude,
      tags: shopData.tags || [],
      is_open: openingStatus.isOpen, // Use computed real-time status
      rating: 0, // TODO: Implement ratings
      orders: deliveredOrdersCount !== null ? deliveredOrdersCount : 0,
      deliveryLogic,
      opening_hours: shopData.opening_hours,
      holidays: shopData.holidays,
      open_status_mode: shopData.open_status_mode,
    };

    return { data: shopDetails, error: null };
  } catch (error: any) {
    console.error('Exception fetching shop details:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Fetch active categories for a shop
 */
export async function fetchShopCategories(shopId: string): Promise<ServiceResult<ShopCategory[]>> {
  try {
    const { data, error } = await supabase
      .from('merchant_categories')
      .select('id, name, description, is_active')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching shop categories:', error);
      return { data: null, error };
    }

    const categories: ShopCategory[] = (data || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      is_active: cat.is_active,
    }));

    return { data: categories, error: null };
  } catch (error: any) {
    console.error('Exception fetching shop categories:', error);
    return { data: null, error: error as PostgrestError };
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
    // Use inner join only when filtering by category, otherwise use left join
    const joinType = categoryId ? 'inner' : 'left';
    
    // Query merchant_items with LEFT JOIN to item_templates to get template images as fallback
    let query = supabase
      .from('merchant_items')
      .select(`
        id,
        name,
        description,
        image_url,
        template_id,
        price_cents,
        currency,
        is_active,
        merchant_item_categories!${joinType}(merchant_category_id),
        item_templates!left(image_url)
      `)
      .eq('shop_id', shopId)
      .eq('is_active', true);

    // Filter by category if provided
    if (categoryId) {
      query = query.eq('merchant_item_categories.merchant_category_id', categoryId);
    }

    // Search by name if query provided
    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery.trim()}%`);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching shop items:', error);
      return { data: null, error };
    }

    // Group items and extract categories
    const itemsMap = new Map<string, ShopItem>();
    
    (data || []).forEach((row: any) => {
      if (!itemsMap.has(row.id)) {
        // Use COALESCE logic: prefer item image_url, fallback to template image_url
        // This matches the merchant_item_view behavior
        // Handle item_templates as object or array (Supabase can return either)
        const templateData = row.item_templates;
        const templateImageUrl = Array.isArray(templateData) 
          ? templateData[0]?.image_url 
          : templateData?.image_url;
        const finalImageUrl = row.image_url || templateImageUrl || null;
        
        itemsMap.set(row.id, {
          id: row.id,
          name: row.name,
          description: row.description,
          image_url: finalImageUrl,
          price_cents: row.price_cents,
          currency: row.currency,
          is_active: row.is_active,
          categories: [],
        });
      }
      
      // Add category ID if available (handle both single object and array responses)
      const categoryData = row.merchant_item_categories;
      if (categoryData) {
        const item = itemsMap.get(row.id)!;
        if (Array.isArray(categoryData)) {
          // Multiple categories
          categoryData.forEach((cat: any) => {
            if (cat?.merchant_category_id && !item.categories.includes(cat.merchant_category_id)) {
              item.categories.push(cat.merchant_category_id);
            }
          });
        } else if (categoryData.merchant_category_id) {
          // Single category
          if (!item.categories.includes(categoryData.merchant_category_id)) {
            item.categories.push(categoryData.merchant_category_id);
          }
        }
      }
    });

    const items = Array.from(itemsMap.values());
    return { data: items, error: null };
  } catch (error: any) {
    console.error('Exception fetching shop items:', error);
    return { data: null, error: error as PostgrestError };
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
    // Fetch current delivery logic from database
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('shop_delivery_logic')
      .select('least_order_value')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (deliveryError) {
      console.error('Error fetching delivery logic for validation:', deliveryError);
      return { 
        data: null, 
        error: deliveryError 
      };
    }

    // If no delivery logic exists, allow the order
    if (!deliveryData) {
      const orderValuePKR = orderValueCents / 100;
      return {
        data: {
          valid: true,
          meetsMinimumOrder: true,
          leastOrderValue: null,
          currentOrderValue: orderValuePKR,
        },
        error: null,
      };
    }

    const leastOrderValue = Number(deliveryData.least_order_value);
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
  } catch (error: any) {
    console.error('Exception validating cart order value:', error);
    return { 
      data: null, 
      error: error as PostgrestError 
    };
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
    const pointWkt = `POINT(${longitude} ${latitude})`;
    
    // Query to check if the point is within any delivery area for this shop
    const { data, error } = await supabase.rpc('find_shops_by_location', {
      point_wkt: pointWkt,
    });

    if (error) {
      console.error('Error validating delivery address:', error);
      return { data: null, error };
    }

    // Check if the shop is in the returned list
    const isWithinDeliveryZone = data ? data.some((shop: any) => shop.id === shopId) : false;

    return {
      data: { isWithinDeliveryZone },
      error: null,
    };
  } catch (error: any) {
    console.error('Exception validating delivery address:', error);
    return { 
      data: null, 
      error: error as PostgrestError 
    };
  }
}

