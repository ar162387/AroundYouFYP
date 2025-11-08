-- Auto-create default delivery logic when a shop is created
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

