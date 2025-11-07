## Inventory UI & Experience Outline

### InventorySection Layout

- **Header**: Displays current shop info, quick stats (active items, hidden items, last update). Include building selector integration to auto-refresh queries.
- **Tabs**: `All Items`, `Templates`, `Categories`, `Audit Log` within existing merchant portal layout.
- **Search & Filters**: Global search bar tied to `inventory_search` endpoint; filters for `category`, `status`, `template/custom`, `price range`.
- **Bulk Actions**: Toolbar for enabling/disabling, assigning categories, launching bulk import modal.

### Item List

- Use Shopify `FlashList` for performance with `estimatedItemSize`.
- Row card shows name, SKU, price, status pill, and template badge.
- Contextual actions: quick toggle active state, edit, view audit log.

### Item Creation / Edit

- `react-hook-form` with resolver for schema validation (Zod).
- **Template adoption**:
  - Step 1 modal: search templates (TanStack Query, infinite scroll).
  - Step 2: preview template details, merchant sets SKU, price, categories, active flag.
  - Fields `name`, `barcode`, `image` locked (display as read-only with tooltip explaining global management).
- **Custom item**: full form with optional image upload, description, multi-select categories (use `FlashList` bottom sheet for selection).
- Save actions use mutations with optimistic feedback and `loogin` logs for success/error tracing.

### Category Management

- Card/grid view with quick edit actions.
- Modal to create category (custom or from template list).
- Drag-and-drop ordering powered by gesture handler for arranging categories; updates `sort_order` in `merchant_item_categories`.

### Audit Log UI

- Table view (FlashList with `getItemType`) showing timestamp, actor, action, summary.
- Filter panel: multi-select change types (create/update/delete), quick date range presets, actor dropdown, source filter.
- Detail drawer: shows diff using inline chips (e.g., `Price 1.99 → 2.49`).
- Ability to jump from log entry to item detail.

### TanStack Query Integration

- Query keys scoped by `shopId` to ensure building-specific caching: `['inventory', shopId, 'items', params]`.
- Background refetch on building switch via `useEffect` watcher reading `bms.currentBuildingId`.
- Mutations invalidate relevant keys and leverage `onSuccess` to show toast notifications.

### Empty / Loading States

- Skeleton loaders that reuse existing design language.
- Encourage merchants to import templates first; show CTA in empty state linking to template catalog.

### Accessibility & Feedback

- Toasts for success/error using existing notification system.
- Read-only template fields have ARIA labels clarifying immutability.
- Inline validations highlight price/SKU requirements before submit.

### Navigation Integration

- Ensure new routes registered in `MerchantShopPortalScreen` use existing layout wrappers.
- Provide deep-link support for opening Audit Log filtered to a specific item.


