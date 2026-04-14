import { apiClient, toApiError } from '../apiClient';

/** Present when POST /merchant/account upgrades role to merchant (new JWT). */
export type MerchantRegistrationSession = {
  access_token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    created_at: string;
  };
};

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
  _userId: string,
  data: CreateMerchantAccountData
): Promise<{
  merchant: MerchantAccount | null;
  session: MerchantRegistrationSession | null;
  error: { message: string } | null;
}> {
  try {
    const response = await apiClient.post<{
      merchant: MerchantAccount;
      access_token?: string;
      expires_at?: string;
      user?: MerchantRegistrationSession['user'];
    }>('/api/v1/merchant/account', data);

    const session =
      response.access_token && response.expires_at && response.user
        ? {
            access_token: response.access_token,
            expires_at: response.expires_at,
            user: response.user,
          }
        : null;

    return { merchant: response.merchant ?? null, session, error: null };
  } catch (error) {
    return { merchant: null, session: null, error: { message: toApiError(error).message } };
  }
}

// Get merchant account by user ID
export async function getMerchantAccount(
  _userId: string
): Promise<{ merchant: MerchantAccount | null; error: { message: string } | null }> {
  try {
    const merchant = await apiClient.get<MerchantAccount>('/api/v1/merchant/account');
    return { merchant, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 404) return { merchant: null, error: null };
    return { merchant: null, error: { message: apiError.message } };
  }
}

// Update merchant status
export async function updateMerchantStatus(
  _merchantId: string,
  status: MerchantStatus
): Promise<{ error: { message: string } | null }> {
  try {
    await apiClient.put('/api/v1/merchant/account', { status });
    return { error: null };
  } catch (error) {
    return { error: { message: toApiError(error).message } };
  }
}

// Submit verification information
export async function submitVerification(
  _userId: string,
  data: VerificationData
): Promise<{ merchant: MerchantAccount | null; error: { message: string } | null }> {
  try {
    const merchant = await apiClient.put<MerchantAccount>('/api/v1/merchant/account', {
      ...data,
      status: 'pending',
    });
    return { merchant, error: null };
  } catch (error) {
    return { merchant: null, error: { message: toApiError(error).message } };
  }
}

// Delete merchant account
export async function deleteMerchantAccount(
  _userId: string
): Promise<{ error: { message: string } | null }> {
  try {
    await apiClient.delete('/api/v1/merchant/account');
    return { error: null };
  } catch (error) {
    return { error: { message: toApiError(error).message } };
  }
}

