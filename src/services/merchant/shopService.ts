import { supabase } from '../supabase';

export type ShopType = 'Grocery' | 'Meat' | 'Vegetable' | 'Stationery' | 'Dairy';

export interface CreateShopData {
  name: string;
  description: string;
  shop_type: ShopType;
  address: string;
  latitude: number;
  longitude: number;
  image_url?: string;
  tags?: string[];
}

export interface MerchantShop {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  shop_type: ShopType;
  address: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  tags: string[];
  is_open: boolean;
  orders_today: number; // Calculated field, not in DB
  orders_cancelled_today: number; // Calculated field, not in DB
  revenue_today: number; // Calculated field, not in DB
  created_at: string;
  updated_at: string;
}

// Upload shop image to Supabase storage
export async function uploadShopImage(
  userId: string,
  imageUri: string
): Promise<{ url: string | null; error: { message: string } | null }> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `shop-${userId}-${timestamp}.jpg`;
    const filePath = `shop-images/${filename}`;

    // Convert image to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('shop-images')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      return { url: null, error: { message: error.message } };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, error: null };
  } catch (error: any) {
    return { url: null, error: { message: error.message || 'Failed to upload image' } };
  }
}

// Pick image from device - this will be implemented in the component using react-native-image-picker
// For now, this is a placeholder function that can accept an image URI
export async function validateImageUri(uri: string): Promise<{ valid: boolean; error: { message: string } | null }> {
  try {
    if (!uri) {
      return { valid: false, error: { message: 'No image URI provided' } };
    }
    // Basic validation - in production, you might want to check file size, format, etc.
    return { valid: true, error: null };
  } catch (error: any) {
    return { valid: false, error: { message: error.message || 'Invalid image' } };
  }
}

// Create a new shop
export async function createShop(
  userId: string,
  data: CreateShopData
): Promise<{ shop: MerchantShop | null; error: { message: string } | null }> {
  try {
    // First, ensure merchant account exists
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (merchantError && merchantError.code !== 'PGRST116') {
      return { shop: null, error: { message: 'Merchant account not found. Please complete merchant registration first.' } };
    }

    // If no merchant account, create one
    let merchantId = merchantAccount?.id;
    if (!merchantId) {
      const { data: newMerchant, error: createMerchantError } = await supabase
        .from('merchant_accounts')
        .insert({
          user_id: userId,
          shop_type: data.shop_type.toLowerCase() as any,
          number_of_shops: '1',
          status: 'none',
        })
        .select('id')
        .single();

      if (createMerchantError) {
        return { shop: null, error: { message: createMerchantError.message } };
      }
      merchantId = newMerchant.id;
    }

    // Create shop
    const { data: shop, error } = await supabase
      .from('shops')
      .insert({
        merchant_id: merchantId,
        name: data.name,
        description: data.description,
        shop_type: data.shop_type,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        image_url: data.image_url || null,
        tags: data.tags || [],
        is_open: true,
      })
      .select()
      .single();

    if (error) {
      return { shop: null, error: { message: error.message } };
    }

    return { shop: shop as MerchantShop, error: null };
  } catch (error: any) {
    return { shop: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Get all shops for a merchant
export async function getMerchantShops(
  userId: string
): Promise<{ shops: MerchantShop[]; error: { message: string } | null }> {
  try {
    // Get merchant account
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (merchantError) {
      return { shops: [], error: null }; // No merchant account, return empty array
    }

    // Get shops
    const { data: shops, error } = await supabase
      .from('shops')
      .select('*')
      .eq('merchant_id', merchantAccount.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { shops: [], error: { message: error.message } };
    }

    // Calculate stats for each shop (this would typically come from orders table)
    // For now, we'll use placeholder values - you'll need to implement actual order stats
    // TODO: Join with orders table to calculate:
    // - orders_today: COUNT(*) WHERE DATE(created_at) = CURRENT_DATE
    // - orders_cancelled_today: COUNT(*) WHERE DATE(created_at) = CURRENT_DATE AND status = 'cancelled'
    // - revenue_today: SUM(total_amount) WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed'
    const shopsWithStats: MerchantShop[] = (shops || []).map((shop) => ({
      ...shop,
      orders_today: 0, // TODO: Calculate from orders table
      orders_cancelled_today: 0, // TODO: Calculate from orders table
      revenue_today: 0, // TODO: Calculate from orders table
    }));

    return { shops: shopsWithStats, error: null };
  } catch (error: any) {
    return { shops: [], error: { message: error.message || 'An error occurred' } };
  }
}

