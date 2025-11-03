-- Create shops table for merchant shops
-- Each merchant can have multiple shops

CREATE TABLE IF NOT EXISTS public.shops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchant_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  shop_type TEXT NOT NULL CHECK (shop_type IN ('Grocery', 'Meat', 'Vegetable', 'Stationery', 'Dairy')),
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster queries
CREATE INDEX idx_shops_merchant_id ON public.shops(merchant_id);
CREATE INDEX idx_shops_shop_type ON public.shops(shop_type);
CREATE INDEX idx_shops_is_open ON public.shops(is_open);
CREATE INDEX idx_shops_created_at ON public.shops(created_at DESC);
-- Geo index for location-based queries (requires PostGIS extension)
-- CREATE INDEX idx_shops_location ON public.shops USING GIST (point(longitude, latitude));

-- Enable RLS
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view shops from their merchant account
CREATE POLICY "Users can view their own shops"
  ON public.shops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_accounts
      WHERE merchant_accounts.id = shops.merchant_id
      AND merchant_accounts.user_id = auth.uid()
    )
  );

-- Users can insert shops for their merchant account
CREATE POLICY "Users can insert their own shops"
  ON public.shops
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.merchant_accounts
      WHERE merchant_accounts.id = shops.merchant_id
      AND merchant_accounts.user_id = auth.uid()
    )
  );

-- Users can update their own shops
CREATE POLICY "Users can update their own shops"
  ON public.shops
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_accounts
      WHERE merchant_accounts.id = shops.merchant_id
      AND merchant_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.merchant_accounts
      WHERE merchant_accounts.id = shops.merchant_id
      AND merchant_accounts.user_id = auth.uid()
    )
  );

-- Users can delete their own shops
CREATE POLICY "Users can delete their own shops"
  ON public.shops
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_accounts
      WHERE merchant_accounts.id = shops.merchant_id
      AND merchant_accounts.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION update_shops_updated_at();

COMMENT ON TABLE public.shops IS 'Stores shop information for merchants';
COMMENT ON COLUMN public.shops.merchant_id IS 'Reference to the merchant account that owns this shop';
COMMENT ON COLUMN public.shops.shop_type IS 'Type of shop: Grocery, Meat, Vegetable, Stationery, or Dairy';
COMMENT ON COLUMN public.shops.latitude IS 'Latitude coordinate for shop location';
COMMENT ON COLUMN public.shops.longitude IS 'Longitude coordinate for shop location';
COMMENT ON COLUMN public.shops.tags IS 'Array of tags for searchability and categorization';

