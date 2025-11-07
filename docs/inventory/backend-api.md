## Inventory Backend API Design

### Guiding Principles

- Reuse shared `apiClient` with automatic `Authorization` and `X-Building-Id` headers.
- Expose REST endpoints from `/merchant/inventory` namespace while keeping global template management under `/admin/catalog`.
- Encapsulate fetch logic in `src/services/merchant/inventoryService.ts`, returning typed DTOs aligned with frontend needs.

### REST Endpoints

#### Merchant-Facing

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/merchant/inventory/categories` | List categories for current shop with template linkage metadata. |
| POST | `/merchant/inventory/categories` | Create category (custom or cloned template). |
| PATCH | `/merchant/inventory/categories/:id` | Update category name/description/active state. |
| DELETE | `/merchant/inventory/categories/:id` | Soft delete category; reassign items to fallback if needed. |
| GET | `/merchant/inventory/items` | Paginated list with filters (category, status, search query, template vs custom). |
| POST | `/merchant/inventory/items` | Create merchant item (custom or template-linked). |
| PATCH | `/merchant/inventory/items/:id` | Update editable fields (sku, price, categories, status, description for custom). |
| POST | `/merchant/inventory/items/bulk-import` | Bulk adopt templates or upload CSV; returns job token. |
| GET | `/merchant/inventory/items/:id/audit-log` | Fetch audit entries for a specific item. |
| GET | `/merchant/inventory/audit-log` | Filterable audit log across items with pagination. |

#### Admin Catalog

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/admin/catalog/templates` | List template items with usage counts. |
| POST | `/admin/catalog/templates` | Create new template item. |
| PATCH | `/admin/catalog/templates/:id` | Update template fields (name, barcode, description, image). |
| DELETE | `/admin/catalog/templates/:id` | Archive template once no merchants reference it. |
| GET | `/admin/catalog/categories` | Manage category templates. |

### Service Layer Responsibilities

- `inventoryService.listCategories()` -> GET categories endpoint, map to UI model with `isTemplateLinked` flag.
- `inventoryService.createCategory(payload)` -> POST new category, clones template metadata when `templateId` provided.
- `inventoryService.listItems(params)` -> GET items with query params for filters, normalizing price units and merging template fields server-side.
- `inventoryService.createItem(payload)` -> Handles both custom and template adoption; enforces required fields based on `templateId` presence.
- `inventoryService.updateItem(id, payload)` -> PATCH constraints to only editable properties; server rejects attempts to modify template-owned fields.
- `inventoryService.fetchAuditLog(filters)` -> GET audit log with query builder for `actionType`, `actorId`, `changeField`, `dateRange`.

### Request / Response Shapes

- **Category DTO**
  ```json
  {
    "id": "uuid",
    "name": "Produce",
    "description": "",
    "isActive": true,
    "isCustom": false,
    "templateId": "uuid",
    "itemCount": 42,
    "createdAt": "2025-11-06T12:30:00.000Z"
  }
  ```
- **Merchant Item DTO**
  ```json
  {
    "id": "uuid",
    "templateId": "uuid",
    "name": "Gala Apple",
    "description": "Fresh",
    "barcode": "0123456789",
    "imageUrl": "https://cdn/",
    "sku": "APL-001",
    "priceCents": 199,
    "isActive": true,
    "isCustom": false,
    "categories": ["uuid"],
    "lastUpdatedBy": {
      "id": "uuid",
      "name": "Alex Tran"
    },
    "updatedAt": "2025-11-06T12:30:00.000Z"
  }
  ```
- **Audit Log DTO**
  ```json
  {
    "id": "uuid",
    "merchantItemId": "uuid",
    "actionType": "UPDATE",
    "changedFields": {
      "priceCents": {"from": 199, "to": 249},
      "isActive": {"from": true, "to": false}
    },
    "actor": {"id": "uuid", "role": "merchant_user"},
    "source": "manual",
    "createdAt": "2025-11-06T12:31:05.000Z"
  }
  ```

### Audit Logging Implementation

- Use database trigger to capture diffs on `merchant_items` writes, serializing `changed_fields` with only modified keys.
- Include `source` header from API (`X-Change-Source`) populated by client actions (single edit, bulk import, sync) for traceability.
- Expose filtering query parameters: `actionType`, `field`, `categoryId`, `dateFrom`, `dateTo`, `actorId`, `source`, `templateId`.

### Background Jobs

- `sync-template-updates`: Runs when templates change, revalidates merchant overrides and emits audit entries with `source = template_update` when cascading updates occur.
- `audit-log-retention`: Periodically archives older logs into cold storage while keeping recent 12 months in hot table.

### Error Handling & Validation

- Return `409 Conflict` when attempting to assign duplicate SKU within a shop.
- Return `422 Unprocessable Entity` for missing required fields depending on custom vs template adoption path.
- Surface Supabase/Postgres constraint errors with user-friendly messages in service layer.

### Security & RLS

- Ensure Supabase policies restrict `merchant_items` and `merchant_categories` by `shop_id` and `building_id`.
- Admin catalog endpoints protected by elevated role; separated Supabase schema if necessary.


