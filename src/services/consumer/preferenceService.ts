/**
 * Preference Service
 * 
 * CRUD service for managing user preferences with structured data storage.
 * Handles preference creation, updates, retrieval, and deletion.
 */

import { supabase, executeWithRetry } from '../supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export type PreferenceType = 'brand' | 'item' | 'category' | 'shop' | 'dietary';
export type EntityType = 'item' | 'shop' | 'category';
export type PreferenceValue = 'prefers' | 'avoids' | 'allergic_to';
export type PreferenceSource = 'explicit' | 'inferred_from_order' | 'conversation';

export interface UserPreference {
  id: string;
  user_id: string;
  preference_type: PreferenceType;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name: string;
  preference_value: PreferenceValue;
  confidence_score: number; // 0.0 to 1.0
  source: PreferenceSource;
  context: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePreferenceInput {
  preference_type: PreferenceType;
  entity_type: EntityType;
  entity_id?: string | null;
  entity_name: string;
  preference_value: PreferenceValue;
  confidence_score?: number;
  source: PreferenceSource;
  context?: Record<string, any> | null;
}

export interface UpdatePreferenceInput {
  preference_value?: PreferenceValue;
  confidence_score?: number;
  context?: Record<string, any> | null;
}

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Get all preferences for the current user
 */
export async function getUserPreferences(
  preferenceType?: PreferenceType
): Promise<ServiceResult<UserPreference[]>> {
  try {
    let query = supabase
      .from('user_preferences')
      .select('*')
      .order('confidence_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (preferenceType) {
      query = query.eq('preference_type', preferenceType);
    }

    const { data, error } = await executeWithRetry(async (client) => {
      return await query;
    });

    if (error) {
      console.error('[PreferenceService] Error fetching preferences:', error);
      return { data: null, error };
    }

    return { data: data as UserPreference[] || [], error: null };
  } catch (error: any) {
    console.error('[PreferenceService] Exception fetching preferences:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Get a specific preference by ID
 */
export async function getPreferenceById(
  preferenceId: string
): Promise<ServiceResult<UserPreference>> {
  try {
    const { data, error } = await executeWithRetry(async (client) => {
      return await client
        .from('user_preferences')
        .select('*')
        .eq('id', preferenceId)
        .single();
    });

    if (error) {
      console.error('[PreferenceService] Error fetching preference:', error);
      return { data: null, error };
    }

    return { data: data as UserPreference, error: null };
  } catch (error: any) {
    console.error('[PreferenceService] Exception fetching preference:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Get preferences for a specific entity
 */
export async function getPreferencesForEntity(
  entityId: string,
  entityType?: EntityType
): Promise<ServiceResult<UserPreference[]>> {
  try {
    let query = supabase
      .from('user_preferences')
      .select('*')
      .eq('entity_id', entityId)
      .order('confidence_score', { ascending: false });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error } = await executeWithRetry(async (client) => {
      return await query;
    });

    if (error) {
      console.error('[PreferenceService] Error fetching entity preferences:', error);
      return { data: null, error };
    }

    return { data: data as UserPreference[] || [], error: null };
  } catch (error: any) {
    console.error('[PreferenceService] Exception fetching entity preferences:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Create a new preference
 */
export async function createPreference(
  input: CreatePreferenceInput
): Promise<ServiceResult<UserPreference>> {
  try {
    const {
      preference_type,
      entity_type,
      entity_id,
      entity_name,
      preference_value,
      confidence_score = 0.5,
      source,
      context,
    } = input;

    // Validate confidence score
    const validatedConfidence = Math.max(0, Math.min(1, confidence_score));

    const { data, error } = await executeWithRetry(async (client) => {
      return await client
        .from('user_preferences')
        .insert({
          preference_type,
          entity_type,
          entity_id: entity_id || null,
          entity_name,
          preference_value,
          confidence_score: validatedConfidence,
          source,
          context: context || null,
        })
        .select()
        .single();
    });

    if (error) {
      console.error('[PreferenceService] Error creating preference:', error);
      
      // Handle unique constraint violation (preference already exists)
      if (error.code === '23505') {
        // Update existing preference instead
        return updatePreferenceByEntity(preference_type, entity_id || '', {
          preference_value,
          confidence_score: validatedConfidence,
          context,
        });
      }
      
      return { data: null, error };
    }

    return { data: data as UserPreference, error: null };
  } catch (error: any) {
    console.error('[PreferenceService] Exception creating preference:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Update an existing preference
 */
export async function updatePreference(
  preferenceId: string,
  input: UpdatePreferenceInput
): Promise<ServiceResult<UserPreference>> {
  try {
    const updates: any = {};

    if (input.preference_value !== undefined) {
      updates.preference_value = input.preference_value;
    }

    if (input.confidence_score !== undefined) {
      updates.confidence_score = Math.max(0, Math.min(1, input.confidence_score));
    }

    if (input.context !== undefined) {
      updates.context = input.context;
    }

    if (Object.keys(updates).length === 0) {
      // No updates to make
      return getPreferenceById(preferenceId);
    }

    const { data, error } = await executeWithRetry(async (client) => {
      return await client
        .from('user_preferences')
        .update(updates)
        .eq('id', preferenceId)
        .select()
        .single();
    });

    if (error) {
      console.error('[PreferenceService] Error updating preference:', error);
      return { data: null, error };
    }

    return { data: data as UserPreference, error: null };
  } catch (error: any) {
    console.error('[PreferenceService] Exception updating preference:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Update preference by entity (useful when entity_id is known but preference_id is not)
 */
export async function updatePreferenceByEntity(
  preferenceType: PreferenceType,
  entityId: string | null,
  input: UpdatePreferenceInput
): Promise<ServiceResult<UserPreference>> {
  try {
    // First, find the existing preference
    let query = supabase
      .from('user_preferences')
      .select('id')
      .eq('preference_type', preferenceType)
      .eq('entity_id', entityId || null)
      .maybeSingle();

    const { data: existing, error: findError } = await executeWithRetry(async (client) => {
      return await query;
    });

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[PreferenceService] Error finding preference:', findError);
      return { data: null, error: findError };
    }

    if (!existing) {
      return { data: null, error: { message: 'Preference not found', code: 'PREFERENCE_NOT_FOUND' } as PostgrestError };
    }

    // Update the found preference
    return updatePreference(existing.id, input);
  } catch (error: any) {
    console.error('[PreferenceService] Exception updating preference by entity:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Delete a preference
 */
export async function deletePreference(
  preferenceId: string
): Promise<ServiceResult<void>> {
  try {
    const { error } = await executeWithRetry(async (client) => {
      return await client
        .from('user_preferences')
        .delete()
        .eq('id', preferenceId);
    });

    if (error) {
      console.error('[PreferenceService] Error deleting preference:', error);
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (error: any) {
    console.error('[PreferenceService] Exception deleting preference:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Upsert a preference (create or update if exists)
 */
export async function upsertPreference(
  input: CreatePreferenceInput
): Promise<ServiceResult<UserPreference>> {
  try {
    // Try to find existing preference
    let query = supabase
      .from('user_preferences')
      .select('id')
      .eq('preference_type', input.preference_type)
      .eq('entity_id', input.entity_id || null)
      .maybeSingle();

    const { data: existing, error: findError } = await executeWithRetry(async (client) => {
      return await query;
    });

    if (findError && findError.code !== 'PGRST116') {
      console.error('[PreferenceService] Error finding preference for upsert:', findError);
      return { data: null, error: findError };
    }

    if (existing) {
      // Update existing
      return updatePreference(existing.id, {
        preference_value: input.preference_value,
        confidence_score: input.confidence_score,
        context: input.context,
      });
    } else {
      // Create new
      return createPreference(input);
    }
  } catch (error: any) {
    console.error('[PreferenceService] Exception upserting preference:', error);
    return { data: null, error: error as PostgrestError };
  }
}

