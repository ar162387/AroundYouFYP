import { supabase } from '../supabase';

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
    const { data, error } = await supabase
      .from('consumer_addresses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ConsumerAddress[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to fetch addresses') };
  }
}

/**
 * Create a new address for the current authenticated user
 */
export async function createAddress(input: CreateAddressInput): Promise<{ data: ConsumerAddress | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    // Check if title is provided and already exists for this user
    if (input.title) {
      const { data: existing } = await supabase
        .from('consumer_addresses')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', input.title)
        .single();

      if (existing) {
        return { data: null, error: new Error(`Address with title "${input.title}" already exists. Please use a different title or update the existing one.`) };
      }
    }

    const { data, error } = await supabase
      .from('consumer_addresses')
      .insert({
        user_id: user.id,
        title: input.title || null,
        street_address: input.street_address,
        city: input.city,
        region: input.region || null,
        latitude: input.latitude,
        longitude: input.longitude,
        landmark: input.landmark || null,
        formatted_address: input.formatted_address || null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ConsumerAddress, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to create address') };
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    // If title is being updated, check if it already exists for another address
    if (input.title !== undefined) {
      const { data: existing } = await supabase
        .from('consumer_addresses')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', input.title)
        .neq('id', addressId)
        .single();

      if (existing) {
        return { data: null, error: new Error(`Address with title "${input.title}" already exists. Please use a different title.`) };
      }
    }

    const { data, error } = await supabase
      .from('consumer_addresses')
      .update({
        ...(input.title !== undefined && { title: input.title || null }),
        ...(input.street_address && { street_address: input.street_address }),
        ...(input.city && { city: input.city }),
        ...(input.region !== undefined && { region: input.region || null }),
        ...(input.latitude !== undefined && { latitude: input.latitude }),
        ...(input.longitude !== undefined && { longitude: input.longitude }),
        ...(input.landmark !== undefined && { landmark: input.landmark || null }),
        ...(input.formatted_address !== undefined && { formatted_address: input.formatted_address || null }),
      })
      .eq('id', addressId)
      .eq('user_id', user.id) // Ensure user can only update their own addresses
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ConsumerAddress, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to update address') };
  }
}

/**
 * Delete an address
 */
export async function deleteAddress(addressId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    const { error } = await supabase
      .from('consumer_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', user.id); // Ensure user can only delete their own addresses

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Failed to delete address') };
  }
}

