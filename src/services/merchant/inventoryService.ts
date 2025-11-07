import type { PostgrestError } from '@supabase/supabase-js';
import { loogin } from '../../lib/loogin';
import { supabase } from '../supabase';
import type {
  InventoryAuditLogEntry,
  InventoryAuditLogFilters,
  InventoryCategory,
  InventoryListParams,
  InventoryListResponse,
  InventoryTemplateItem,
  InventoryTemplateCategory,
  InventoryItem,
} from '../../types/inventory';

const log = loogin.scope('inventoryService');

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function mapCategory(row: any): InventoryCategory {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active ?? true,
    isCustom: row.is_custom ?? false,
    templateId: row.template_id,
    itemCount: row.item_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: any): InventoryItem {
  return {
    id: row.id,
    shopId: row.shop_id,
    templateId: row.template_id,
    name: row.name,
    description: row.description,
    barcode: row.barcode,
    imageUrl: row.image_url,
    sku: row.sku,
    priceCents: row.price_cents ?? 0,
    currency: row.currency ?? 'PKR',
    isActive: row.is_active ?? true,
    isCustom: row.is_custom ?? false,
    categories: (row.categories ?? []).map(mapCategory),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUpdatedBy: row.last_updated_by ?? null,
  };
}

function mapAudit(row: any): InventoryAuditLogEntry {
  return {
    id: row.id,
    shopId: row.shop_id,
    merchantItemId: row.merchant_item_id,
    actionType: row.action_type,
    changedFields: row.changed_fields ?? {},
    source: row.source ?? 'manual',
    actor: row.actor ?? { id: 'system', role: 'system' },
    createdAt: row.created_at,
  };
}

export async function fetchInventoryCategories(shopId: string): Promise<ServiceResult<InventoryCategory[]>> {
  log.debug('fetchInventoryCategories', { shopId });

  const { data, error } = await supabase
    .from('merchant_categories')
    .select('*, item_count:merchant_item_categories(count)')
    .eq('shop_id', shopId)
    .order('name', { ascending: true });

  if (error) {
    log.error('Failed to fetch categories', error);
    return { data: null, error };
  }

  const mapped = (data ?? []).map((row: any) => mapCategory({ ...row, item_count: row.item_count?.[0]?.count ?? 0 }));
  return { data: mapped, error: null };
}

export async function createInventoryCategory(payload: {
  shopId: string;
  name: string;
  description?: string | null;
  templateId?: string | null;
}): Promise<ServiceResult<InventoryCategory>> {
  log.debug('createInventoryCategory', payload);

  const { data, error } = await supabase
    .from('merchant_categories')
    .insert({
      shop_id: payload.shopId,
      name: payload.name,
      description: payload.description ?? null,
      template_id: payload.templateId ?? null,
      is_custom: !payload.templateId,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    log.error('Failed to create category', error);
    return { data: null, error };
  }

  return { data: mapCategory({ ...data, item_count: 0 }), error: null };
}

export async function updateInventoryCategory(
  categoryId: string,
  updates: Partial<Pick<InventoryCategory, 'name' | 'description' | 'isActive'>>
): Promise<ServiceResult<InventoryCategory>> {
  log.debug('updateInventoryCategory', { categoryId, updates });

  const { data, error } = await supabase
    .from('merchant_categories')
    .update({
      name: updates.name,
      description: updates.description,
      is_active: updates.isActive,
    })
    .eq('id', categoryId)
    .select()
    .single();

  if (error) {
    log.error('Failed to update category', error);
    return { data: null, error };
  }

  return { data: mapCategory({ ...data, item_count: data.item_count ?? 0 }), error: null };
}

export async function fetchInventoryItems(
  shopId: string,
  params: InventoryListParams = {}
): Promise<ServiceResult<InventoryListResponse>> {
  log.debug('fetchInventoryItems', { shopId, params });

  let query = supabase
    .from('merchant_item_view')
    .select('*')
    .eq('shop_id', shopId)
    .limit(params.limit ?? 50);

  if (params.search) {
    const trimmed = params.search.trim();
    if (trimmed.length > 0) {
      const escaped = escapeIlike(trimmed);
      const likeValue = `%${escaped}%`;
      query = query.or(
        [
          `name.ilike.${likeValue}`,
          `description.ilike.${likeValue}`,
          `sku.ilike.${likeValue}`,
          `barcode.ilike.${likeValue}`,
        ].join(',')
      );
    }
  }
  if (params.categoryIds && params.categoryIds.length > 0) {
    query = query.contains('category_ids', params.categoryIds);
  }
  if (params.active !== null && params.active !== undefined) {
    query = query.eq('is_active', params.active);
  }
  if (params.templateFilter === 'template') {
    query = query.not('template_id', 'is', null);
  }
  if (params.templateFilter === 'custom') {
    query = query.is('template_id', null);
  }
  if (params.cursor) {
    query = query.gt('updated_at', params.cursor);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch inventory items', error);
    return { data: null, error };
  }

  const items = (data ?? []).map(mapItem);
  const nextCursor = items.length > 0 ? items[items.length - 1].updatedAt : null;

  return { data: { items, nextCursor }, error: null };
}

export async function createInventoryItem(payload: {
  shopId: string;
  templateId?: string | null;
  name: string;
  description?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  sku: string;
  priceCents: number;
  isActive: boolean;
  categoryIds: string[];
}): Promise<ServiceResult<InventoryItem>> {
  log.debug('createInventoryItem', { shopId: payload.shopId, templateId: payload.templateId });

  const { data, error } = await supabase
    .from('merchant_items')
    .insert({
      shop_id: payload.shopId,
      template_id: payload.templateId ?? null,
      name: payload.name,
      description: payload.description ?? null,
      barcode: payload.barcode ?? null,
      image_url: payload.imageUrl ?? null,
      sku: payload.sku,
      price_cents: payload.priceCents,
      is_active: payload.isActive,
      is_custom: !payload.templateId,
    })
    .select('*, categories:merchant_item_categories(merchant_categories(*))')
    .single();

  if (error) {
    log.error('Failed to create inventory item', error);
    return { data: null, error };
  }

  if (payload.categoryIds.length > 0) {
    await supabase.from('merchant_item_categories').insert(
      payload.categoryIds.map((categoryId, index) => ({
        merchant_item_id: data.id,
        merchant_category_id: categoryId,
        sort_order: index,
      }))
    );
  }

  return { data: mapItem({ ...data, categories: data.categories?.map((c: any) => c.merchant_categories) ?? [] }), error: null };
}

export async function updateInventoryItem(
  itemId: string,
  updates: Partial<Pick<InventoryItem, 'description' | 'sku' | 'priceCents' | 'isActive'>> & {
    categoryIds?: string[];
  }
): Promise<ServiceResult<InventoryItem>> {
  log.debug('updateInventoryItem', { itemId, updates });

  const { categoryIds, ...itemUpdates } = updates;

  const { data, error } = await supabase
    .from('merchant_items')
    .update({
      description: itemUpdates.description,
      sku: itemUpdates.sku,
      price_cents: itemUpdates.priceCents,
      is_active: itemUpdates.isActive,
    })
    .eq('id', itemId)
    .select('*, categories:merchant_item_categories(merchant_categories(*))')
    .single();

  if (error) {
    log.error('Failed to update inventory item', error);
    return { data: null, error };
  }

  if (categoryIds) {
    await supabase.from('merchant_item_categories').delete().eq('merchant_item_id', itemId);
    if (categoryIds.length > 0) {
      await supabase.from('merchant_item_categories').insert(
        categoryIds.map((categoryId, index) => ({
          merchant_item_id: itemId,
          merchant_category_id: categoryId,
          sort_order: index,
        }))
      );
    }
  }

  return { data: mapItem({ ...data, categories: data.categories?.map((c: any) => c.merchant_categories) ?? [] }), error: null };
}

export async function toggleInventoryItemActive(itemId: string, isActive: boolean): Promise<ServiceResult<InventoryItem>> {
  return updateInventoryItem(itemId, { isActive });
}

export async function fetchInventoryTemplates(params: {
  search?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ServiceResult<{ items: InventoryTemplateItem[]; nextCursor?: string | null }>> {
  log.debug('fetchInventoryTemplates', params);

  let query = supabase
    .from('item_templates')
    .select('*')
    .limit(params.limit ?? 50)
    .order('updated_at', { ascending: false });

  if (params.search) {
    const trimmed = params.search.trim();
    if (trimmed.length > 0) {
      const escaped = escapeIlike(trimmed);
      const likeValue = `%${escaped}%`;
      query = query.or(
        [`name.ilike.${likeValue}`, `barcode.ilike.${likeValue}`, `description.ilike.${likeValue}`].join(',')
      );
    }
  }
  if (params.cursor) {
    query = query.gt('updated_at', params.cursor);
  }

  const { data, error } = await query;

  if (error) {
    log.error('Failed to fetch templates', error);
    return { data: null, error };
  }

  const items = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    description: row.description,
    imageUrl: row.image_url,
    defaultUnit: row.default_unit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const nextCursor = items.length > 0 ? items[items.length - 1].updatedAt : null;

  return { data: { items, nextCursor }, error: null };
}

export async function fetchTemplateCategories(): Promise<ServiceResult<InventoryTemplateCategory[]>> {
  const { data, error } = await supabase.from('category_templates').select('*').order('name', { ascending: true });
  if (error) {
    log.error('Failed to fetch template categories', error);
    return { data: null, error };
  }

  const categories = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { data: categories, error: null };
}

export async function fetchInventoryAuditLog(
  shopId: string,
  filters: InventoryAuditLogFilters = {}
): Promise<ServiceResult<{ entries: InventoryAuditLogEntry[]; nextCursor?: string | null }>> {
  log.debug('fetchInventoryAuditLog', { shopId, filters });

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.actionTypes && filters.actionTypes.length > 0) {
    query = query.in('action_type', filters.actionTypes);
  }
  if (filters.actorIds && filters.actorIds.length > 0) {
    query = query.in('actor->>id', filters.actorIds);
  }
  if (filters.field) {
    query = query.contains('changed_fields', { [filters.field]: {} });
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }
  if (filters.source) {
    query = query.eq('source', filters.source);
  }
  if (filters.merchantItemId) {
    query = query.eq('merchant_item_id', filters.merchantItemId);
  }
  if (filters.cursor) {
    query = query.lt('created_at', filters.cursor);
  }

  const { data, error } = await query;

  if (error) {
    log.error('Failed to fetch audit log', error);
    return { data: null, error };
  }

  const entries = (data ?? []).map(mapAudit);
  const nextCursor = entries.length > 0 ? entries[entries.length - 1].createdAt : null;

  return { data: { entries, nextCursor }, error: null };
}

export async function bulkAdoptTemplates(payload: {
  shopId: string;
  templateIds: string[];
  defaultCategoryId?: string | null;
}): Promise<ServiceResult<{ jobId: string }>> {
  log.debug('bulkAdoptTemplates', payload);

  const { data, error } = await supabase
    .rpc('bulk_adopt_templates', {
      p_shop_id: payload.shopId,
      p_template_ids: payload.templateIds,
      p_default_category_id: payload.defaultCategoryId ?? null,
    })
    .single();

  if (error) {
    log.error('Failed to trigger bulk adoption', error);
    return { data: null, error };
  }

  const jobResponse = (data as { job_id?: string | null } | null) ?? {};
  return { data: { jobId: jobResponse.job_id ?? 'pending' }, error: null };
}

export async function deleteInventoryItem(itemId: string): Promise<ServiceResult<{ id: string }>> {
  const deleteItem = async () =>
    supabase.from('merchant_items').delete().eq('id', itemId).select('id').single();

  const attempt = await deleteItem();
  if (!attempt.error) {
    return { data: attempt.data as { id: string }, error: null };
  }

  if (attempt.error.code !== '23503') {
    log.error('Failed to delete inventory item', attempt.error);
    return { data: null, error: attempt.error };
  }

  const { error: updateError } = await supabase
    .from('audit_logs')
    .update({ merchant_item_id: null })
    .eq('merchant_item_id', itemId);

  if (updateError) {
    log.error('Failed to nullify audit log references before deleting item', updateError);
    return { data: null, error: updateError };
  }

  const retry = await deleteItem();
  if (retry.error) {
    log.error('Failed to delete inventory item on retry', retry.error);
    return { data: null, error: retry.error };
  }

  return { data: retry.data as { id: string }, error: null };
}

export async function deleteInventoryCategory(categoryId: string): Promise<ServiceResult<{ id: string }>> {
  const { data: linkedItems, error: linkedError } = await supabase
    .from('merchant_item_categories')
    .select('merchant_item_id')
    .eq('merchant_category_id', categoryId);

  if (linkedError) {
    log.error('Failed to inspect category links', linkedError);
    return { data: null, error: linkedError };
  }

  const linkedRows = (linkedItems ?? []) as { merchant_item_id: string | null }[];
  const itemIds = Array.from(new Set(linkedRows.map((row) => row.merchant_item_id).filter((id): id is string => Boolean(id))));

  if (itemIds.length > 0) {
    const { data: allLinks, error: allLinksError } = await supabase
      .from('merchant_item_categories')
      .select('merchant_item_id, merchant_category_id')
      .in('merchant_item_id', itemIds);

    if (allLinksError) {
      log.error('Failed to inspect item category assignments', allLinksError);
      return { data: null, error: allLinksError };
    }

    const typedLinks = (allLinks ?? []) as {
      merchant_item_id: string | null;
      merchant_category_id: string | null;
    }[];

    const grouped = new Map<string, Set<string>>();
    typedLinks.forEach((link) => {
      const itemId = link.merchant_item_id;
      const category = link.merchant_category_id;
      if (!itemId || !category) {
        return;
      }
      const set = grouped.get(itemId) ?? new Set<string>();
      const normalizedCategory = category as string;
      set.add(normalizedCategory);
      grouped.set(itemId, set);
    });

    const blocked = Array.from(grouped.entries()).some(
      ([, categories]) => categories.size <= 1 || (categories.size === 1 && categories.has(categoryId))
    );

    if (blocked) {
      const conflictError: PostgrestError = {
        name: 'CategoryConflictError',
        code: '409',
        details: 'category_has_single_assignment',
        hint: 'Reassign impacted items to another category before deleting.',
        message: 'Cannot delete category because one or more items only belong to this category.',
      };
      return { data: null, error: conflictError };
    }
  }

  const { data, error } = await supabase
    .from('merchant_categories')
    .delete()
    .eq('id', categoryId)
    .select('id')
    .single();

  if (error) {
    log.error('Failed to delete inventory category', error);
    return { data: null, error };
  }
  return { data: data as { id: string }, error: null };
}


