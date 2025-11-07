DROP TRIGGER IF EXISTS shop_delivery_areas_prevent_overlap ON public.shop_delivery_areas;
DROP TRIGGER IF EXISTS shop_delivery_areas_touch ON public.shop_delivery_areas;

DROP INDEX IF EXISTS shop_delivery_areas_geom_idx;
DROP INDEX IF EXISTS shop_delivery_areas_shop_id_idx;
DROP INDEX IF EXISTS shop_delivery_areas_created_at_idx;

DROP POLICY IF EXISTS "Shop owners can delete delivery areas" ON public.shop_delivery_areas;
DROP POLICY IF EXISTS "Shop owners can update delivery areas" ON public.shop_delivery_areas;
DROP POLICY IF EXISTS "Shop owners can insert delivery areas" ON public.shop_delivery_areas;
DROP POLICY IF EXISTS "Shop owners can view delivery areas" ON public.shop_delivery_areas;

DROP VIEW IF EXISTS public.shop_delivery_areas_view;

DROP TABLE IF EXISTS public.shop_delivery_areas;

DROP FUNCTION IF EXISTS public.prevent_shop_delivery_area_overlap();

