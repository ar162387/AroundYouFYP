import { supabase } from '../supabase';

export type ShopType = 'grocery' | 'meat' | 'vegetable' | 'mart' | 'other';
export type MerchantStatus = 'none' | 'pending' | 'verified';
export type NumberOfShops = '1' | '2' | '3+';

export interface MerchantAccount {
  id: string;
  user_id: string;
  shop_type: ShopType;
  number_of_shops: NumberOfShops;
  status: MerchantStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateMerchantAccountData {
  shop_type: ShopType;
  number_of_shops: NumberOfShops;
}

// Create merchant account
export async function createMerchantAccount(
  userId: string,
  data: CreateMerchantAccountData
): Promise<{ merchant: MerchantAccount | null; error: { message: string } | null }> {
  try {
    const { data: merchant, error } = await supabase
      .from('merchant_accounts')
      .insert({
        user_id: userId,
        shop_type: data.shop_type,
        number_of_shops: data.number_of_shops,
        status: 'none',
      })
      .select()
      .single();

    if (error) {
      return { merchant: null, error: { message: error.message } };
    }

    return { merchant, error: null };
  } catch (error: any) {
    return { merchant: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Get merchant account by user ID
export async function getMerchantAccount(
  userId: string
): Promise<{ merchant: MerchantAccount | null; error: { message: string } | null }> {
  try {
    const { data: merchant, error } = await supabase
      .from('merchant_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { merchant: null, error: { message: error.message } };
    }

    if (error && error.code === 'PGRST116') {
      return { merchant: null, error: null }; // No merchant account found, not an error
    }

    return { merchant, error: null };
  } catch (error: any) {
    return { merchant: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Update merchant status
export async function updateMerchantStatus(
  merchantId: string,
  status: MerchantStatus
): Promise<{ error: { message: string } | null }> {
  try {
    const { error } = await supabase
      .from('merchant_accounts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', merchantId);

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

