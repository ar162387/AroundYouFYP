-- Add Distance Layer and Free Delivery Discount Layer to shop_delivery_logic table
-- This migration adds the distance-based pricing and free delivery features

DO $$
BEGIN
  -- Add Distance Layer columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_delivery_logic' AND column_name = 'distance_mode') THEN
    ALTER TABLE public.shop_delivery_logic ADD COLUMN distance_mode TEXT NOT NULL DEFAULT 'auto';
    ALTER TABLE public.shop_delivery_logic ADD CONSTRAINT check_distance_mode CHECK (distance_mode IN ('auto', 'custom'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_delivery_logic' AND column_name = 'max_delivery_fee') THEN
    ALTER TABLE public.shop_delivery_logic ADD COLUMN max_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 130.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_delivery_logic' AND column_name = 'distance_tiers') THEN
    ALTER TABLE public.shop_delivery_logic ADD COLUMN distance_tiers JSONB NOT NULL DEFAULT '[
      {"max_distance": 200, "fee": 20},
      {"max_distance": 400, "fee": 30},
      {"max_distance": 600, "fee": 40},
      {"max_distance": 800, "fee": 50},
      {"max_distance": 1000, "fee": 60}
    ]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_delivery_logic' AND column_name = 'beyond_tier_fee_per_unit') THEN
    ALTER TABLE public.shop_delivery_logic ADD COLUMN beyond_tier_fee_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 10.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_delivery_logic' AND column_name = 'beyond_tier_distance_unit') THEN
    ALTER TABLE public.shop_delivery_logic ADD COLUMN beyond_tier_distance_unit NUMERIC(10, 2) NOT NULL DEFAULT 250.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_delivery_logic' AND column_name = 'free_delivery_threshold') THEN
    ALTER TABLE public.shop_delivery_logic ADD COLUMN free_delivery_threshold NUMERIC(10, 2) NOT NULL DEFAULT 800.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_delivery_logic' AND column_name = 'free_delivery_radius') THEN
    ALTER TABLE public.shop_delivery_logic ADD COLUMN free_delivery_radius NUMERIC(10, 2) NOT NULL DEFAULT 1000.00;
  END IF;

  -- Add validation constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND table_name = 'shop_delivery_logic' AND constraint_name = 'check_max_delivery_fee') THEN
    ALTER TABLE public.shop_delivery_logic ADD CONSTRAINT check_max_delivery_fee CHECK (max_delivery_fee > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND table_name = 'shop_delivery_logic' AND constraint_name = 'check_free_delivery_threshold') THEN
    ALTER TABLE public.shop_delivery_logic ADD CONSTRAINT check_free_delivery_threshold CHECK (free_delivery_threshold >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND table_name = 'shop_delivery_logic' AND constraint_name = 'check_free_delivery_radius') THEN
    ALTER TABLE public.shop_delivery_logic ADD CONSTRAINT check_free_delivery_radius CHECK (free_delivery_radius >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND table_name = 'shop_delivery_logic' AND constraint_name = 'check_beyond_tier_fee') THEN
    ALTER TABLE public.shop_delivery_logic ADD CONSTRAINT check_beyond_tier_fee CHECK (beyond_tier_fee_per_unit >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND table_name = 'shop_delivery_logic' AND constraint_name = 'check_beyond_tier_unit') THEN
    ALTER TABLE public.shop_delivery_logic ADD CONSTRAINT check_beyond_tier_unit CHECK (beyond_tier_distance_unit > 0);
  END IF;
END $$;

-- Add column comments
COMMENT ON COLUMN public.shop_delivery_logic.distance_mode IS 'Distance calculation mode: auto (default algorithm) or custom';
COMMENT ON COLUMN public.shop_delivery_logic.max_delivery_fee IS 'Maximum delivery fee cap (default: 130 PKR)';
COMMENT ON COLUMN public.shop_delivery_logic.distance_tiers IS 'JSONB array of distance tiers with max_distance (meters) and fee (PKR)';
COMMENT ON COLUMN public.shop_delivery_logic.beyond_tier_fee_per_unit IS 'Fee per distance unit beyond the last tier (default: 10 PKR per 250m)';
COMMENT ON COLUMN public.shop_delivery_logic.beyond_tier_distance_unit IS 'Distance unit for beyond-tier calculation (default: 250 meters)';
COMMENT ON COLUMN public.shop_delivery_logic.free_delivery_threshold IS 'Order value threshold for free delivery eligibility (default: 800 PKR)';
COMMENT ON COLUMN public.shop_delivery_logic.free_delivery_radius IS 'Maximum distance for free delivery eligibility (default: 1000 meters)';

