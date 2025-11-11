-- Add public read policy for merchant_items
-- This allows consumers to read active items from open shops for browsing

CREATE POLICY "Anyone can view active items from open shops"
  ON public.merchant_items
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = merchant_items.shop_id
        AND s.is_open = true
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
        AND s.is_open = true
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
        AND s.is_open = true
    )
  );

