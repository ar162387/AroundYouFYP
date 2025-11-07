-- Rollback migration for public read policies

-- Drop the function
DROP FUNCTION IF EXISTS public.find_shops_by_location(TEXT);

-- Drop the policies
DROP POLICY IF EXISTS "Anyone can view shops" ON public.shops;
DROP POLICY IF EXISTS "Anyone can view delivery areas" ON public.shop_delivery_areas;

-- Revoke SELECT on view from anon role
REVOKE SELECT ON public.shop_delivery_areas_view FROM anon;

