-- ============================================================================
-- FIX DELIVERY FEE CALCULATION - Combined Migration
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- 1. Update find_shops_by_location function to include shop coordinates
-- This allows calculating distance and delivery fees on the client side

-- Drop the existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.find_shops_by_location(TEXT);

-- Recreate the function with coordinates in the return type
CREATE FUNCTION public.find_shops_by_location(
  point_wkt TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  image_url TEXT,
  tags TEXT[],
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_open BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    s.id,
    s.name,
    s.image_url,
    s.tags,
    s.address,
    s.latitude,
    s.longitude,
    s.is_open,
    s.created_at
  FROM public.shops s
  INNER JOIN public.shop_delivery_areas sda ON sda.shop_id = s.id
  WHERE s.is_open = true
    AND ST_Contains(sda.geom, ST_GeomFromText(point_wkt, 4326))
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.find_shops_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.find_shops_by_location(TEXT) TO authenticated;

-- 2. Add public read policy for shop_delivery_logic
-- This allows consumers to read delivery logic to calculate delivery fees
CREATE POLICY IF NOT EXISTS "Anyone can view delivery logic"
  ON public.shop_delivery_logic
  FOR SELECT
  USING (true);

-- 3. Auto-create default delivery logic when a shop is created
-- This ensures every shop has delivery logic with default distance tiering
CREATE OR REPLACE FUNCTION public.create_default_delivery_logic()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.shop_delivery_logic (
    shop_id,
    minimum_order_value,
    small_order_surcharge,
    least_order_value,
    distance_mode,
    max_delivery_fee,
    distance_tiers,
    beyond_tier_fee_per_unit,
    beyond_tier_distance_unit,
    free_delivery_threshold,
    free_delivery_radius
  ) VALUES (
    NEW.id,
    200.00,
    40.00,
    100.00,
    'auto',
    130.00,
    '[
      {"max_distance": 200, "fee": 20},
      {"max_distance": 400, "fee": 30},
      {"max_distance": 600, "fee": 40},
      {"max_distance": 800, "fee": 50},
      {"max_distance": 1000, "fee": 60}
    ]'::jsonb,
    10.00,
    250.00,
    800.00,
    1000.00
  )
  ON CONFLICT (shop_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create delivery logic for new shops
DROP TRIGGER IF EXISTS auto_create_delivery_logic ON public.shops;
CREATE TRIGGER auto_create_delivery_logic
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_delivery_logic();

-- 4. Backfill delivery logic for existing shops that don't have it
-- This ensures all existing shops have default delivery logic
INSERT INTO public.shop_delivery_logic (
  shop_id,
  minimum_order_value,
  small_order_surcharge,
  least_order_value,
  distance_mode,
  max_delivery_fee,
  distance_tiers,
  beyond_tier_fee_per_unit,
  beyond_tier_distance_unit,
  free_delivery_threshold,
  free_delivery_radius
)
SELECT 
  s.id,
  200.00,
  40.00,
  100.00,
  'auto',
  130.00,
  '[
    {"max_distance": 200, "fee": 20},
    {"max_distance": 400, "fee": 30},
    {"max_distance": 600, "fee": 40},
    {"max_distance": 800, "fee": 50},
    {"max_distance": 1000, "fee": 60}
  ]'::jsonb,
  10.00,
  250.00,
  800.00,
  1000.00
FROM public.shops s
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.shop_delivery_logic sdl 
  WHERE sdl.shop_id = s.id
)
ON CONFLICT (shop_id) DO NOTHING;

