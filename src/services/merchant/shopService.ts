import { supabase } from '../supabase';
import type { OrderStatus } from '../../types/orders';
import Config from 'react-native-config';
import type {
  DayKey,
  DayOpeningHours,
  OpeningHoursConfig,
  ShopHoliday,
  OpenStatusMode,
} from '../../utils/shopOpeningHours';
import { getCurrentOpeningStatus } from '../../utils/shopOpeningHours';

export type ShopType = 'Grocery' | 'Meat' | 'Vegetable' | 'Stationery' | 'Dairy' | 'Pharmacy';

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
  // Optional scheduling fields (may be null for existing shops)
  opening_hours?: OpeningHoursConfig | null;
  holidays?: ShopHoliday[] | null;
  open_status_mode?: OpenStatusMode | null;
  orders_today: number; // Calculated field, not in DB
  orders_cancelled_today: number; // Calculated field, not in DB
  revenue_today: number; // Calculated field, not in DB
  created_at: string;
  updated_at: string;
}

export type UpdateShopData = Partial<CreateShopData> & {
  opening_hours?: OpeningHoursConfig | null;
  holidays?: ShopHoliday[] | null;
  open_status_mode?: OpenStatusMode | null;
  is_open?: boolean;
};

// Helper function to upload using Supabase Storage API
// Note: Supabase Storage uses S3 backend. The S3 credentials you created bypass RLS at the storage level.
// We use Supabase Storage API endpoint which internally uses the S3 backend with your credentials.
async function uploadWithStorageAPI(
  supabaseUrl: string,
  apikey: string,
  authToken: string,
  bucketName: string,
  filePath: string,
  imageUri: string,
  mime: string,
  filename: string
): Promise<{ url: string | null; error: { message: string } | null }> {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${encodedPath}`;
  
  // Create FormData with the file
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: mime,
    name: filename,
  } as any);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        console.log(`Upload progress: ${percentComplete.toFixed(2)}%`);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('✅ Upload successful');
        // Get public URL from Supabase
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);
        resolve({ url: urlData.publicUrl, error: null });
      } else {
        let errorMessage = 'Upload failed';
        try {
          const errorData = JSON.parse(xhr.responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `Upload failed with status ${xhr.status}`;
        }
        console.error('❌ Upload error:', errorMessage, xhr.status, xhr.responseText);
        resolve({ url: null, error: { message: errorMessage } });
      }
    });

    xhr.addEventListener('error', () => {
      console.error('❌ Upload network error');
      resolve({ url: null, error: { message: 'Network request failed. Please check your internet connection.' } });
    });

    xhr.addEventListener('abort', () => {
      console.error('❌ Upload aborted');
      resolve({ url: null, error: { message: 'Upload was cancelled' } });
    });

    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.setRequestHeader('apikey', apikey);
    xhr.setRequestHeader('x-upsert', 'false');
    
    xhr.send(formData);
  });
}

// Upload shop image to Supabase storage
export async function uploadShopImage(
  userId: string,
  imageUri: string
): Promise<{ url: string | null; error: { message: string } | null }> {
  try {
    // Derive mime type from uri; default to jpeg
    const deriveMimeFromUri = (uri: string): { extension: string; mime: string } => {
      const lower = uri.split('?')[0].split('#')[0].toLowerCase();
      if (lower.endsWith('.png')) return { extension: 'png', mime: 'image/png' };
      if (lower.endsWith('.webp')) return { extension: 'webp', mime: 'image/webp' };
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { extension: 'jpg', mime: 'image/jpeg' };
      // iOS photo library URIs (ph://) and most camera outputs are jpeg by default
      return { extension: 'jpg', mime: 'image/jpeg' };
    };

    const { extension, mime } = deriveMimeFromUri(imageUri);

    // Generate unique filename with correct extension
    const timestamp = Date.now();
    const filename = `shop-${userId}-${timestamp}.${extension}`;
    // Path within the bucket (can include subdirectories)
    const filePath = `shop-images/${filename}`;

    // For React Native, we need to handle local file URIs differently
    if (imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('ph://')) {
      // Local file - Upload using Supabase Storage API
      // Note: Supabase Storage uses S3 backend. Your S3 access keys bypass RLS at the storage level.
      console.log('Uploading file:', { filePath, mime, filename, uriPrefix: imageUri.substring(0, 20) });

      const supabaseUrl = Config.SUPABASE_URL || '';
      const supabaseAnonKey = Config.SUPABASE_ANON_KEY || '';
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return { url: null, error: { message: 'Supabase configuration missing' } };
      }

      // Get session token for authenticated upload
      // RLS policies should allow authenticated users to upload to shop-images bucket
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        return { url: null, error: { message: 'Not authenticated. Please log in again.' } };
      }

      console.log('✅ Uploading with authenticated session (RLS policies should allow this)');
      return uploadWithStorageAPI(
        supabaseUrl,
        supabaseAnonKey,
        session.access_token,
        'shop-images',
        filePath,
        imageUri,
        mime,
        filename
      );
    } else if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      // Remote URL - fetch and convert to blob
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('shop-images')
        .upload(filePath, blob, {
          contentType: mime,
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return { url: null, error: { message: error.message } };
      }
    } else {
      return { url: null, error: { message: 'Unsupported image URI format' } };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, error: null };
  } catch (error: any) {
    console.error('Upload error:', error);
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

// Update an existing shop
export async function updateShop(
  shopId: string,
  userId: string,
  data: UpdateShopData
): Promise<{ shop: MerchantShop | null; error: { message: string } | null }> {
  try {
    // Verify the shop belongs to the user's merchant account
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (merchantError) {
      return { shop: null, error: { message: 'Merchant account not found.' } };
    }

    // Verify shop ownership
    const { data: existingShop, error: shopError } = await supabase
      .from('shops')
      .select('merchant_id')
      .eq('id', shopId)
      .single();

    if (shopError || !existingShop) {
      return { shop: null, error: { message: 'Shop not found.' } };
    }

    if (existingShop.merchant_id !== merchantAccount.id) {
      return { shop: null, error: { message: 'You do not have permission to update this shop.' } };
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.shop_type !== undefined) updateData.shop_type = data.shop_type;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    // Handle image_url: null means remove, undefined means don't change, string means update
    if (data.image_url !== undefined) {
      updateData.image_url = data.image_url === null ? null : (data.image_url || null);
    }
    if (data.tags !== undefined) updateData.tags = data.tags || [];
    if (data.opening_hours !== undefined) updateData.opening_hours = data.opening_hours;
    if (data.holidays !== undefined) updateData.holidays = data.holidays;
    if (data.open_status_mode !== undefined) updateData.open_status_mode = data.open_status_mode;
    if (data.is_open !== undefined) updateData.is_open = data.is_open;

    // Update shop
    const { data: shop, error } = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', shopId)
      .select()
      .single();

    if (error) {
      return { shop: null, error: { message: error.message } };
    }

    // Return shop with calculated stats (same as getMerchantShops)
    const shopWithStats: MerchantShop = {
      ...shop,
      orders_today: 0,
      orders_cancelled_today: 0,
      revenue_today: 0,
    };

    return { shop: shopWithStats, error: null };
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const shopsWithStats: MerchantShop[] = await Promise.all(
      (shops || []).map(async (shop) => {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('status,total_cents')
          .eq('shop_id', shop.id)
          .gte('placed_at', startOfToday.toISOString())
          .lt('placed_at', startOfTomorrow.toISOString());

        if (ordersError || !ordersData) {
          if (ordersError) {
            console.error('Error loading order stats for shop', { shopId: shop.id, error: ordersError });
          }

          return {
            ...shop,
            orders_today: 0,
            orders_cancelled_today: 0,
            revenue_today: 0,
          };
        }

        const orders = ordersData as Array<{ status: OrderStatus; total_cents: number | null }>;

        let ordersToday = 0;
        let cancelledToday = 0;
        let revenueCents = 0;

        orders.forEach((order) => {
          ordersToday += 1;
          if (order.status === 'cancelled') {
            cancelledToday += 1;
            return;
          }
          if (order.status === 'delivered' && typeof order.total_cents === 'number') {
            revenueCents += order.total_cents;
          }
        });

        // Compute real-time opening status based on opening hours
        const openingStatus = getCurrentOpeningStatus({
          opening_hours: shop.opening_hours as any,
          holidays: shop.holidays as any,
          open_status_mode: shop.open_status_mode as any,
        });

        return {
          ...shop,
          is_open: openingStatus.isOpen, // Override stored value with computed real-time status
          orders_today: ordersToday,
          orders_cancelled_today: cancelledToday,
          revenue_today: revenueCents / 100,
        };
      })
    );

    return { shops: shopsWithStats, error: null };
  } catch (error: any) {
    return { shops: [], error: { message: error.message || 'An error occurred' } };
  }
}

// Delete a shop
export async function deleteShop(
  shopId: string,
  userId: string
): Promise<{ error: { message: string } | null }> {
  try {
    // Verify the shop belongs to the user's merchant account
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (merchantError) {
      return { error: { message: 'Merchant account not found.' } };
    }

    // Verify shop ownership
    const { data: existingShop, error: shopError } = await supabase
      .from('shops')
      .select('merchant_id')
      .eq('id', shopId)
      .single();

    if (shopError || !existingShop) {
      return { error: { message: 'Shop not found.' } };
    }

    if (existingShop.merchant_id !== merchantAccount.id) {
      return { error: { message: 'You do not have permission to delete this shop.' } };
    }

    // Count orders for informational message (orders will be preserved with NULL shop_id)
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId);

    // Delete the shop
    // Orders will have their shop_id set to NULL automatically due to ON DELETE SET NULL constraint
    // This preserves order history while allowing shop deletion
    const { error: deleteError } = await supabase
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (deleteError) {
      return { error: { message: deleteError.message } };
    }

    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

