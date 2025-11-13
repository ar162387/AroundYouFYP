import { supabase } from '../supabase';
import type { Shop } from '../supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type { DeliveryLogic } from '../merchant/deliveryLogicService';

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
      delivery_fee: 0, // Will be calculated based on distance and delivery logic
      delivery_time: undefined, // N/A for now
      tags: row.tags || [],
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
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
      .select('id, name, image_url, tags, address, latitude, longitude, is_open, created_at')
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
      delivery_fee: 0, // Will be calculated based on distance and delivery logic
      delivery_time: undefined,
      tags: row.tags || [],
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
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

/**
 * Fetch detailed shop information including delivery logic
 */
export async function fetchShopDetails(shopId: string): Promise<ServiceResult<ShopDetails>> {
  try {
    // Fetch shop info
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('id, name, description, image_url, address, latitude, longitude, tags, is_open')
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

    const shopDetails: ShopDetails = {
      id: shopData.id,
      name: shopData.name,
      description: shopData.description,
      image_url: shopData.image_url,
      address: shopData.address,
      latitude: shopData.latitude,
      longitude: shopData.longitude,
      tags: shopData.tags || [],
      is_open: shopData.is_open,
      rating: 0, // TODO: Implement ratings
      orders: 0, // TODO: Implement order count
      deliveryLogic,
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

    console.log('Fetching shop items:', { shopId, categoryId, searchQuery });
    const { data, error } = await query;
    console.log('Shop items result:', { itemCount: data?.length, error });

    if (error) {
      console.error('Error fetching shop items:', error);
      return { data: null, error };
    }

    // Log raw data sample for debugging
    if (data && data.length > 0) {
      const firstRow: any = data[0];
      const templateData = firstRow.item_templates;
      const templateImageUrl = Array.isArray(templateData) 
        ? (templateData[0] as any)?.image_url 
        : (templateData as any)?.image_url;
      console.log('Raw data sample (first row):', {
        id: firstRow.id,
        name: firstRow.name,
        image_url: firstRow.image_url,
        template_image_url: templateImageUrl,
        hasTemplate: !!templateData,
        rawRow: JSON.stringify(firstRow).substring(0, 300),
      });
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
    console.log('Processed items:', items.length);
    if (items.length > 0) {
      console.log('First item sample:', {
        id: items[0].id,
        name: items[0].name,
        image_url: items[0].image_url,
        hasImage: !!items[0].image_url,
        price_cents: items[0].price_cents,
      });
      // Log items with images for debugging
      const itemsWithImages = items.filter(item => item.image_url);
      console.log(`Items with images: ${itemsWithImages.length}/${items.length}`);
      if (itemsWithImages.length > 0) {
        console.log('Sample item with image:', {
          name: itemsWithImages[0].name,
          image_url: itemsWithImages[0].image_url,
        });
      }
    }
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

