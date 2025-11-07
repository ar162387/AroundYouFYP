## Inventory Data Model

### Core Tables

- `item_templates`
  - **Fields**: `id` (uuid, pk), `name`, `barcode`, `description`, `image_url`, `default_unit`, `created_at`, `updated_at`, `created_by_admin_id`
  - **Purpose**: Represents the global catalog entry for commonly shared grocery items. Name, barcode, and description are owned by HQ admins and immutable for merchants. Updates here cascade into merchant views.

- `merchant_items`
  - **Fields**: `id` (uuid, pk), `shop_id`, `template_id` (nullable), `name`, `description`, `image_url`, `sku`, `price`, `is_active`, `is_custom`, `created_at`, `updated_at`, `created_by_user_id`
  - **Purpose**: Captures the inventory row that belongs to a merchant shop. When linked to a template (`template_id`), immutable fields mirror the template via views; otherwise for `is_custom = true`, all attributes are editable.
  - **Constraints**: Unique composite index on `(shop_id, sku)`; `price` stored in smallest currency unit (e.g., cents) with integer column `price_cents`; `sku` required for active items.

- `merchant_item_categories`
  - **Fields**: `merchant_item_id`, `merchant_category_id`, `sort_order`
  - **Purpose**: Join table supporting many-to-many assignments between merchant items and categories, with optional ordering per category.

- `merchant_categories`
  - **Fields**: `id` (uuid, pk), `shop_id`, `name`, `description`, `is_custom`, `template_category_id` (nullable), `created_at`, `updated_at`
  - **Purpose**: Categories scoped to a single shop. For built-in category adoption, `template_category_id` links to `category_templates` (future-proofing); otherwise merchants own full control.
  - **Constraints**: Unique index on `(shop_id, lower(name))` to avoid duplicates ignoring case.

- `category_templates`
  - **Fields**: `id` (uuid, pk), `name`, `description`, `created_at`, `updated_at`
  - **Purpose**: Optional seed catalog for quick-start category creation. Merchants can clone these into `merchant_categories` while retaining edit control locally.

- `audit_logs`
  - **Fields**: `id` (uuid, pk), `shop_id`, `merchant_item_id`, `actor_id`, `actor_role`, `action_type`, `change_summary`, `changed_fields` (jsonb), `source`, `created_at`
  - **Purpose**: Immutable history of item mutations. JSON payload stores field-level diffs for price, sku, status, categories, etc., enabling filtered queries.

### Relationships & Ownership

- Every `merchant_items.shop_id` references `shops.id`; RLS policies enforce `bms.currentBuildingId` scoping.
- When `merchant_items.template_id` is set, the row inherits `name`, `barcode`, `description`, and `image_url` via database view or computed fields; merchants may override SKU, price, active flag, and category assignments.
- Custom items (`is_custom = true`) have `template_id` null and all fields editable.
- Categories follow the same pattern: local copies with optional linkage to templates for analytics alignment.

### Derived Views & Materializations

- `merchant_item_view`
  - Exposes the effective item attributes by coalescing merchant overrides with template values. Used by API reads to avoid duplicating merge logic.
- `inventory_search`
  - Materialized view indexing `merchant_items` and template names for quick SKU/name search within a shop.

### Validation Rules

- Ensure at least one category assignment for active items via check constraint and trigger.
- Prevent deletion of templates that are currently linked (`merchant_items.template_id` foreign key with `on delete restrict`).
- Auditing trigger on `merchant_items` insert/update/delete writes granular change data into `audit_logs` using `jsonb_build_object`.

### Data Lifecycle

1. **Adopt template**: Merchant selects template; system inserts `merchant_items` row with template linkage, auto-seeding categories based on template recommendations.
2. **Create custom item**: Merchant crafts new item; `is_custom` flagged, optional cloning from template fields for speed.
3. **Template update**: Admin edits template fields; background job rebuilds cached projections so linked merchant rows reflect new name/barcode immediately.
4. **Audit event**: Any mutation (manual edit, bulk import, system sync) writes to `audit_logs` with actor metadata and diff payload.

### Future Extensions

- Track inventory counts and reorder thresholds via `merchant_item_stock` table once physical stock tracking is added.
- Introduce `bulk_import_jobs` to record CSV uploads or API syncs, tying back to audit entries via `source_reference`.

