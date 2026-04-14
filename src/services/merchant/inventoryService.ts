import { loogin } from '../../lib/loogin';
import { apiClient, toApiError } from '../apiClient';
import Config from 'react-native-config';
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

type ServiceResult<T> = { data: T | null; error: any | null };
const categoryShopMap = new Map<string, string>();
const itemShopMap = new Map<string, string>();

function getBackendBaseUrl(): string {
  return (
    Config.BACKEND_API_URL ||
    Config.DOTNET_API_URL ||
    Config.API_BASE_URL ||
    Config.BACKEND_URL ||
    ''
  ).replace(/\/+$/, '');
}

function toAbsoluteBackendUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) return url;
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${normalizedPath}`;
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function mapCategory(row: any): InventoryCategory {
  if (row.id && row.shop_id) {
    categoryShopMap.set(row.id, row.shop_id);
  }
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
  if (row.id && row.shop_id) {
    itemShopMap.set(row.id, row.shop_id);
  }
  return {
    id: row.id,
    shopId: row.shop_id,
    templateId: row.template_id,
    name: row.name,
    description: row.description,
    barcode: row.barcode,
    imageUrl: toAbsoluteBackendUrl(row.image_url),
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

function normalizeAuditFieldValue(value: unknown): { from: unknown; to: unknown } {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'from' in value && 'to' in value) {
    const o = value as { from: unknown; to: unknown };
    return { from: o.from, to: o.to };
  }
  return { from: null, to: value };
}

function mapAudit(row: any): InventoryAuditLogEntry {
  const rawFields = row.changed_fields ?? {};
  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(rawFields)) {
    changedFields[k] = normalizeAuditFieldValue(v);
  }

  const rawActor = row.actor ?? {};
  const actor = {
    id: String((rawActor as any).id ?? 'system'),
    name: (rawActor as any).name ?? null,
    email: (rawActor as any).email ?? null,
    role: ((rawActor as any).role === 'merchant' ? 'merchant_user' : (rawActor as any).role) ?? 'merchant_user',
  } as InventoryAuditLogEntry['actor'];

  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    merchantItemId: row.merchant_item_id != null ? String(row.merchant_item_id) : '',
    actionType: row.action_type,
    changedFields,
    source: row.source ?? 'manual',
    actor,
    createdAt: row.created_at,
  };
}

function isLocalImageUri(uri?: string | null): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
}

async function uploadItemImage(shopId: string, itemId: string, imageUri: string): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: imageUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg',
    name: `item-${itemId}-${Date.now()}.jpg`,
  } as any);
  const response = await apiClient.put<{ image_url?: string; imageUrl?: string }>(
    `/api/v1/merchant/shops/${shopId}/inventory/${itemId}/image`,
    formData,
    { isFormData: true }
  );
  return toAbsoluteBackendUrl(response?.image_url || response?.imageUrl || null);
}

export async function fetchInventoryCategories(shopId: string): Promise<ServiceResult<InventoryCategory[]>> {
  log.debug('fetchInventoryCategories', { shopId });
  try {
    const data = await apiClient.get<any[]>(`/api/v1/merchant/shops/${shopId}/categories`);
    const mapped = (data ?? []).map((row: any) => mapCategory({ ...row, shop_id: row.shop_id || shopId }));
    return { data: mapped, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to fetch categories', apiError);
    return { data: null, error: apiError };
  }
}

export async function createInventoryCategory(payload: {
  shopId: string;
  name: string;
  description?: string | null;
  templateId?: string | null;
}): Promise<ServiceResult<InventoryCategory>> {
  log.debug('createInventoryCategory', payload);

  try {
    const data = await apiClient.post<any>(`/api/v1/merchant/shops/${payload.shopId}/categories`, {
      name: payload.name,
      description: payload.description ?? null,
      template_id: payload.templateId ?? null,
    });
    return { data: mapCategory({ ...data, shop_id: payload.shopId }), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to create category', apiError);
    return { data: null, error: apiError };
  }
}

export async function updateInventoryCategory(
  categoryId: string,
  updates: Partial<Pick<InventoryCategory, 'name' | 'description' | 'isActive'>>
): Promise<ServiceResult<InventoryCategory>> {
  log.debug('updateInventoryCategory', { categoryId, updates });
  const shopId = categoryShopMap.get(categoryId);
  if (!shopId) {
    return {
      data: null,
      error: {
        name: 'CategoryLookupError',
        code: 'category_lookup_failed',
        message: 'Category context is missing. Reload categories and try again.',
        details: '',
        hint: '',
      },
    };
  }
  try {
    const data = await apiClient.put<any>(`/api/v1/merchant/shops/${shopId}/categories/${categoryId}`, {
      name: updates.name,
      description: updates.description,
      is_active: updates.isActive,
    });
    return { data: mapCategory({ ...data, shop_id: shopId }), error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}

export async function fetchInventoryItems(
  shopId: string,
  params: InventoryListParams = {}
): Promise<ServiceResult<InventoryListResponse>> {
  log.debug('fetchInventoryItems', { shopId, params });
  try {
    const data = await apiClient.get<any[]>(`/api/v1/merchant/shops/${shopId}/items`);
    let items = (data ?? []).map((row) => mapItem({ ...row, shop_id: row.shop_id || shopId }));
    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }
    if (params.active !== null && params.active !== undefined) {
      items = items.filter((item) => item.isActive === params.active);
    }
    if (params.categoryIds?.length) {
      items = items.filter((item) => item.categories.some((cat) => params.categoryIds?.includes(cat.id)));
    }
    if (params.limit) {
      items = items.slice(0, params.limit);
    }
    const nextCursor = items.length > 0 ? items[items.length - 1].updatedAt : null;
    return { data: { items, nextCursor }, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to fetch inventory items', apiError);
    return { data: null, error: apiError };
  }
}

export async function createInventoryItem(payload: {
  shopId: string;
  templateId?: string | null;
  name: string;
  description?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  priceCents: number;
  isActive: boolean;
  categoryIds: string[];
}): Promise<ServiceResult<InventoryItem>> {
  log.debug('createInventoryItem', { shopId: payload.shopId, templateId: payload.templateId });
  try {
    const localImageUri = isLocalImageUri(payload.imageUrl) ? payload.imageUrl : null;
    const data = await apiClient.post<any>(`/api/v1/merchant/shops/${payload.shopId}/items`, {
      template_id: payload.templateId ?? null,
      name: payload.name,
      description: payload.description ?? null,
      barcode: payload.barcode ?? null,
      image_url: localImageUri ? null : payload.imageUrl ?? null,
      sku: payload.sku ?? null,
      price_cents: payload.priceCents,
      is_active: payload.isActive,
      category_ids: payload.categoryIds,
    });
    let mapped = mapItem({ ...data, shop_id: payload.shopId });
    if (localImageUri) {
      const uploaded = await uploadItemImage(payload.shopId, mapped.id, localImageUri);
      if (uploaded) {
        mapped = { ...mapped, imageUrl: toAbsoluteBackendUrl(uploaded) };
      }
    }
    return { data: mapped, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}

export async function updateInventoryItem(
  itemId: string,
  updates: Partial<Pick<InventoryItem, 'description' | 'sku' | 'priceCents' | 'isActive' | 'imageUrl'>> & {
    categoryIds?: string[];
  }
): Promise<ServiceResult<InventoryItem>> {
  log.debug('updateInventoryItem', { itemId, updates });
  const shopId = itemShopMap.get(itemId);
  if (!shopId) {
    return {
      data: null,
      error: {
        name: 'ItemLookupError',
        code: 'item_lookup_failed',
        message: 'Item context is missing. Reload items and try again.',
        details: '',
        hint: '',
      },
    };
  }
  try {
    const localImageUri = isLocalImageUri(updates.imageUrl) ? updates.imageUrl : null;
    const data = await apiClient.put<any>(`/api/v1/merchant/shops/${shopId}/items/${itemId}`, {
      description: updates.description,
      sku: updates.sku,
      price_cents: updates.priceCents,
      is_active: updates.isActive,
      image_url: localImageUri ? undefined : updates.imageUrl,
      category_ids: updates.categoryIds,
    });
    let mapped = mapItem({ ...data, shop_id: shopId });
    if (localImageUri) {
      const uploaded = await uploadItemImage(shopId, itemId, localImageUri);
      if (uploaded) {
        mapped = { ...mapped, imageUrl: toAbsoluteBackendUrl(uploaded) };
      }
    }
    return { data: mapped, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}

export async function toggleInventoryItemActive(itemId: string, isActive: boolean): Promise<ServiceResult<InventoryItem>> {
  return updateInventoryItem(itemId, { isActive });
}

export async function fetchInventoryTemplates(params: {
  search?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ServiceResult<{ items: InventoryTemplateItem[]; nextCursor?: string | null }>> {
  try {
    const query = params.search ? `?search=${encodeURIComponent(params.search)}` : '';
    const data = await apiClient.get<any[]>(`/api/v1/merchant/templates/items${query}`);
    const items = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      barcode: row.barcode,
      description: row.description,
      imageUrl: toAbsoluteBackendUrl(row.image_url),
      defaultUnit: row.default_unit,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return { data: { items, nextCursor: null }, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}

export async function fetchTemplateCategories(): Promise<ServiceResult<InventoryTemplateCategory[]>> {
  try {
    const data = await apiClient.get<any[]>('/api/v1/merchant/templates/categories');
    const categories = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return { data: categories, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}

export async function fetchInventoryAuditLog(
  shopId: string,
  filters: InventoryAuditLogFilters = {}
): Promise<ServiceResult<{ entries: InventoryAuditLogEntry[]; nextCursor?: string | null }>> {
  log.debug('fetchInventoryAuditLog', { shopId, filters });
  try {
    // Hermes / RN URLSearchParams often lacks .set(); build query string manually.
    const pairs: string[] = [];
    if (filters.limit != null) pairs.push(`limit=${encodeURIComponent(String(filters.limit))}`);
    if (filters.merchantItemId) pairs.push(`merchantItemId=${encodeURIComponent(filters.merchantItemId)}`);
    if (filters.cursor) pairs.push(`cursor=${encodeURIComponent(filters.cursor)}`);
    const qs = pairs.length > 0 ? pairs.join('&') : '';
    const path = `/api/v1/merchant/shops/${shopId}/items/audit-log${qs ? `?${qs}` : ''}`;
    const data = await apiClient.get<{ entries: any[]; next_cursor?: string | null }>(path);
    const entries = (data?.entries ?? []).map(mapAudit);
    return { data: { entries, nextCursor: data?.next_cursor ?? null }, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    log.error('Failed to fetch inventory audit log', apiError);
    return { data: null, error: apiError };
  }
}

export async function bulkAdoptTemplates(payload: {
  shopId: string;
  templateIds: string[];
  defaultCategoryId?: string | null;
}): Promise<ServiceResult<{ jobId: string }>> {
  void payload;
  return { data: { jobId: 'unsupported' }, error: null };
}

export async function deleteInventoryItem(itemId: string): Promise<ServiceResult<{ id: string }>> {
  const shopId = itemShopMap.get(itemId);
  if (!shopId) {
    return {
      data: null,
      error: {
        name: 'ItemLookupError',
        code: 'item_lookup_failed',
        message: 'Item context is missing. Reload items and try again.',
        details: '',
        hint: '',
      },
    };
  }
  try {
    await apiClient.delete(`/api/v1/merchant/shops/${shopId}/items/${itemId}`);
    return { data: { id: itemId }, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}

export async function deleteInventoryCategory(categoryId: string): Promise<ServiceResult<{ id: string }>> {
  const shopId = categoryShopMap.get(categoryId);
  if (!shopId) {
    return {
      data: null,
      error: {
        name: 'CategoryLookupError',
        code: 'category_lookup_failed',
        message: 'Category context is missing. Reload categories and try again.',
        details: '',
        hint: '',
      },
    };
  }
  try {
    await apiClient.delete(`/api/v1/merchant/shops/${shopId}/categories/${categoryId}`);
    return { data: { id: categoryId }, error: null };
  } catch (error) {
    const apiError = toApiError(error);
    return { data: null, error: apiError };
  }
}


