import { apiClient, toApiError } from '../apiClient';

export type AddressTitle = 'home' | 'office' | null;

export type ConsumerAddress = {
  id: string;
  user_id: string;
  title: AddressTitle;
  street_address: string;
  city: string;
  region: string | null;
  latitude: number;
  longitude: number;
  landmark: string | null;
  formatted_address: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAddressInput = {
  title?: AddressTitle;
  street_address: string;
  city: string;
  region?: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  formatted_address?: string;
};

export type UpdateAddressInput = Partial<CreateAddressInput>;

/**
 * Get all addresses for the current authenticated user
 */
export async function getUserAddresses(): Promise<{ data: ConsumerAddress[] | null; error: Error | null }> {
  try {
    const data = await apiClient.get<ConsumerAddress[]>('/api/v1/consumer/addresses');
    return { data: data as ConsumerAddress[], error: null };
  } catch (error) {
    return { data: null, error: new Error(toApiError(error).message) };
  }
}

/**
 * Create a new address for the current authenticated user
 */
export async function createAddress(input: CreateAddressInput): Promise<{ data: ConsumerAddress | null; error: Error | null }> {
  try {
    const data = await apiClient.post<ConsumerAddress>('/api/v1/consumer/addresses', input);
    return { data: data as ConsumerAddress, error: null };
  } catch (error) {
    return { data: null, error: new Error(toApiError(error).message) };
  }
}

/**
 * Update an existing address
 */
export async function updateAddress(
  addressId: string,
  input: UpdateAddressInput
): Promise<{ data: ConsumerAddress | null; error: Error | null }> {
  try {
    const data = await apiClient.put<ConsumerAddress>(`/api/v1/consumer/addresses/${addressId}`, input);
    return { data: data as ConsumerAddress, error: null };
  } catch (error) {
    return { data: null, error: new Error(toApiError(error).message) };
  }
}

/**
 * Delete an address
 */
export async function deleteAddress(addressId: string): Promise<{ error: Error | null }> {
  try {
    await apiClient.delete(`/api/v1/consumer/addresses/${addressId}`);
    return { error: null };
  } catch (error) {
    return { error: new Error(toApiError(error).message) };
  }
}

