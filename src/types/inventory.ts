export type InventoryActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'IMPORT'
  | 'TEMPLATE_UPDATE';

export type InventoryChangeSource = 'manual' | 'bulk_import' | 'system_sync' | 'backfill' | 'template_update';

export interface InventoryCategory {
  id: string;
  shopId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  isCustom: boolean;
  templateId?: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTemplateCategory {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTemplateItem {
  id: string;
  name: string;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  defaultUnit?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  shopId: string;
  templateId?: string | null;
  name: string;
  description?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  sku: string;
  priceCents: number;
  currency?: string;
  isActive: boolean;
  isCustom: boolean;
  categories: InventoryCategory[];
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy?: InventoryAuditActor | null;
}

export interface InventoryAuditActor {
  id: string;
  name?: string | null;
  email?: string | null;
  role: 'merchant_user' | 'merchant_admin' | 'system' | 'hq_admin';
}

export interface InventoryAuditLogEntry {
  id: string;
  shopId: string;
  merchantItemId: string;
  actionType: InventoryActionType;
  changedFields: Record<string, { from: unknown; to: unknown }>;
  source: InventoryChangeSource;
  actor: InventoryAuditActor;
  createdAt: string;
}

export interface InventoryListParams {
  search?: string;
  categoryIds?: string[];
  active?: boolean | null;
  templateFilter?: 'all' | 'template' | 'custom';
  cursor?: string | null;
  limit?: number;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  nextCursor?: string | null;
  total?: number;
}

export interface InventoryAuditLogFilters {
  actionTypes?: InventoryActionType[];
  actorIds?: string[];
  field?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: InventoryChangeSource;
  merchantItemId?: string;
  limit?: number;
  cursor?: string | null;
}


