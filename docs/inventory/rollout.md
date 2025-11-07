## Rollout Plan for Inventory Feature

### Database Migrations

1. **Phase 1 – Catalog Foundations**
   - Create `item_templates`, `category_templates`, `merchant_items`, `merchant_categories`, `merchant_item_categories`, `audit_logs` tables.
   - Add views `merchant_item_view`, `inventory_search`.
   - Implement triggers for audit logging and category enforcement.
   - Apply RLS policies scoped by `shop_id` and `building_id`.

2. **Phase 2 – Seed Data**
   - Seed core grocery templates (produce, pantry, dairy) via Supabase migration or admin script.
   - Populate starter categories aligning with templates.
   - Provide tooling for importing GS1 barcode dataset incrementally.

3. **Phase 3 – Backfill Existing Merchants**
   - Script to translate current items into `merchant_items`, linking templates when matches found by barcode/normalized name.
   - Log backfill actions in `audit_logs` with `source = backfill`.

### Deployment Steps

- Deploy migrations to staging branch via Supabase CLI.
- Run seed scripts and validate views.
- Deploy backend services (`inventoryService`, admin endpoints), then frontend UI with feature flag.
- Monitor audit log volume and query performance before enabling for all shops.

### QA Checklist

- [ ] Create custom category and item; verify display and audit log entry.
- [ ] Adopt template item, set SKU/price, ensure template name locks.
- [ ] Update price and status; confirm audit log diff and filters.
- [ ] Switch buildings; ensure inventory lists refresh correctly.
- [ ] Bulk import scenarios: CSV upload and template batch adoption.
- [ ] Admin updates template name; confirm merchant view reflects change.
- [ ] RLS test: attempt cross-shop access and ensure denied.
- [ ] Mobile perf: FlashList remains smooth with 500 items.

### Rollback Strategy

- Maintain backup of tables pre-migration.
- For issues, disable feature flag and revert to legacy views; audit data remains append-only and can be archived.


