-- Rollback script for inventory system migration 009

DROP FUNCTION IF EXISTS public.bulk_adopt_templates(UUID, UUID[], UUID);
DROP MATERIALIZED VIEW IF EXISTS public.inventory_search;
DROP VIEW IF EXISTS public.merchant_item_view;

DROP TRIGGER IF EXISTS merchant_items_log_delete ON public.merchant_items;
DROP TRIGGER IF EXISTS merchant_items_log_update ON public.merchant_items;
DROP TRIGGER IF EXISTS merchant_items_log_insert ON public.merchant_items;
DROP TRIGGER IF EXISTS merchant_items_actor ON public.merchant_items;
DROP TRIGGER IF EXISTS merchant_items_touch ON public.merchant_items;
DROP TRIGGER IF EXISTS merchant_categories_touch ON public.merchant_categories;

DROP FUNCTION IF EXISTS public.log_inventory_change();
DROP FUNCTION IF EXISTS public.set_inventory_last_updated_actor();
DROP FUNCTION IF EXISTS public.touch_updated_at();

DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.merchant_item_categories;
DROP TABLE IF EXISTS public.merchant_items;
DROP TABLE IF EXISTS public.merchant_categories;
DROP TABLE IF EXISTS public.item_templates;
DROP TABLE IF EXISTS public.category_templates;


