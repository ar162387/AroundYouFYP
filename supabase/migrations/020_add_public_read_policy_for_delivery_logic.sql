-- Add public read policy for shop_delivery_logic
-- This allows consumers to read delivery logic to calculate delivery fees

CREATE POLICY "Anyone can view delivery logic"
  ON public.shop_delivery_logic
  FOR SELECT
  USING (true);

