-- Add Pharmacy to shop_type constraint
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_shop_type_check;
ALTER TABLE public.shops ADD CONSTRAINT shops_shop_type_check 
  CHECK (shop_type IN ('Grocery', 'Meat', 'Vegetable', 'Stationery', 'Dairy', 'Pharmacy'));

-- Update comment
COMMENT ON COLUMN public.shops.shop_type IS 'Type of shop: Grocery, Meat, Vegetable, Stationery, Dairy, or Pharmacy';

