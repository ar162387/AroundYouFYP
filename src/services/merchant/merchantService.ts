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
  name_as_per_cnic?: string | null;
  cnic?: string | null;
  cnic_expiry?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMerchantAccountData {
  shop_type: ShopType;
  number_of_shops: NumberOfShops;
}

export interface VerificationData {
  name_as_per_cnic: string;
  cnic: string;
  cnic_expiry: string; // ISO date string
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

// Submit verification information
export async function submitVerification(
  userId: string,
  data: VerificationData
): Promise<{ merchant: MerchantAccount | null; error: { message: string } | null }> {
  try {
    // First get the merchant account
    const { merchant: existingMerchant, error: fetchError } = await getMerchantAccount(userId);
    
    if (fetchError) {
      return { merchant: null, error: fetchError };
    }

    if (!existingMerchant) {
      return { merchant: null, error: { message: 'Merchant account not found' } };
    }

    // Update with verification data and set status to pending
    const { data: merchant, error } = await supabase
      .from('merchant_accounts')
      .update({
        name_as_per_cnic: data.name_as_per_cnic,
        cnic: data.cnic,
        cnic_expiry: data.cnic_expiry,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingMerchant.id)
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

// Delete merchant account
export async function deleteMerchantAccount(
  userId: string
): Promise<{ error: { message: string } | null }> {
  try {
    // First check if merchant account exists
    const { merchant, error: fetchError } = await getMerchantAccount(userId);
    
    if (fetchError) {
      return { error: fetchError };
    }

    if (!merchant) {
      return { error: { message: 'Merchant account not found' } };
    }

    // Check if there are any shops
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id')
      .eq('merchant_id', merchant.id);

    if (shopsError) {
      return { error: { message: shopsError.message } };
    }

    if (shops && shops.length > 0) {
      return { error: { message: `Cannot delete merchant account. Please delete all ${shops.length} shop(s) first.` } };
    }

    // Delete the merchant account
    const { error: deleteError } = await supabase
      .from('merchant_accounts')
      .delete()
      .eq('id', merchant.id);

    if (deleteError) {
      return { error: { message: deleteError.message } };
    }

    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

