-- Fix RLS policies for merchant_items and merchant_categories
-- Update policies to use computed is_open status instead of stored field
-- This ensures consumers can see items from shops that are open based on opening hours

-- Drop existing public read policies
DROP POLICY IF EXISTS "Anyone can view active items from open shops" ON public.merchant_items;
DROP POLICY IF EXISTS "Anyone can view active categories from open shops" ON public.merchant_categories;
DROP POLICY IF EXISTS "Anyone can view item categories from open shops" ON public.merchant_item_categories;

-- Recreate policies using computed is_open function
CREATE POLICY "Anyone can view active items from open shops"
  ON public.merchant_items
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = merchant_items.shop_id
        AND public.compute_shop_is_open(s) = true
    )
  );

-- Also allow public read access to merchant_categories for open shops
CREATE POLICY "Anyone can view active categories from open shops"
  ON public.merchant_categories
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = merchant_categories.shop_id
        AND public.compute_shop_is_open(s) = true
    )
  );

-- Allow public read access to merchant_item_categories for items from open shops
CREATE POLICY "Anyone can view item categories from open shops"
  ON public.merchant_item_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_items mi
      JOIN public.shops s ON s.id = mi.shop_id
      WHERE mi.id = merchant_item_categories.merchant_item_id
        AND mi.is_active = true
        AND public.compute_shop_is_open(s) = true
    )
  );

