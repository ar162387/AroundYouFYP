-- Backfill delivery logic for existing shops that don't have it
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

