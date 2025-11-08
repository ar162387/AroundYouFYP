-- Delivery runners for merchant shops
CREATE TABLE IF NOT EXISTS public.delivery_runners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS delivery_runners_shop_id_idx ON public.delivery_runners (shop_id);
CREATE INDEX IF NOT EXISTS delivery_runners_created_at_idx ON public.delivery_runners (created_at DESC);

ALTER TABLE public.delivery_runners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view delivery runners"
  ON public.delivery_runners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = delivery_runners.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can insert delivery runners"
  ON public.delivery_runners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = delivery_runners.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update delivery runners"
  ON public.delivery_runners
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = delivery_runners.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = delivery_runners.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can delete delivery runners"
  ON public.delivery_runners
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = delivery_runners.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE TRIGGER delivery_runners_touch
  BEFORE UPDATE ON public.delivery_runners
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

