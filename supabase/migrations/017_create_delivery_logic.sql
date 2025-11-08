-- Delivery Logic settings for shops
-- Stores order value layer and distance layer configurations

CREATE TABLE IF NOT EXISTS public.shop_delivery_logic (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  
  -- Order Value Layer
  minimum_order_value NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
  small_order_surcharge NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
  least_order_value NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  
  -- Ensure one delivery logic config per shop
  CONSTRAINT unique_shop_delivery_logic UNIQUE (shop_id),
  
  -- Validation constraints
  CONSTRAINT check_minimum_order_value CHECK (minimum_order_value > 0),
  CONSTRAINT check_small_order_surcharge CHECK (small_order_surcharge >= 0),
  CONSTRAINT check_least_order_value CHECK (least_order_value > 0),
  CONSTRAINT check_value_hierarchy CHECK (least_order_value <= minimum_order_value)
);

CREATE INDEX IF NOT EXISTS shop_delivery_logic_shop_id_idx ON public.shop_delivery_logic (shop_id);
CREATE INDEX IF NOT EXISTS shop_delivery_logic_created_at_idx ON public.shop_delivery_logic (created_at DESC);

ALTER TABLE public.shop_delivery_logic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view delivery logic"
  ON public.shop_delivery_logic
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_logic.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can insert delivery logic"
  ON public.shop_delivery_logic
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_logic.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update delivery logic"
  ON public.shop_delivery_logic
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_logic.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_logic.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE TRIGGER shop_delivery_logic_touch
  BEFORE UPDATE ON public.shop_delivery_logic
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.shop_delivery_logic IS 'Stores delivery logic settings including order value layer and distance layer configurations';
COMMENT ON COLUMN public.shop_delivery_logic.minimum_order_value IS 'Default order value threshold (default: 200 PKR). Orders below this get a surcharge.';
COMMENT ON COLUMN public.shop_delivery_logic.small_order_surcharge IS 'Surcharge applied when order value is below minimum_order_value (default: 40 PKR)';
COMMENT ON COLUMN public.shop_delivery_logic.least_order_value IS 'Hard floor - absolute minimum order value. Orders below this are rejected (default: 100 PKR)';

