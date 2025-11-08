-- Delivery areas for merchant shops
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.shop_delivery_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  label TEXT,
  geom geometry(Polygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX IF NOT EXISTS shop_delivery_areas_shop_id_idx ON public.shop_delivery_areas (shop_id);
CREATE INDEX IF NOT EXISTS shop_delivery_areas_geom_idx ON public.shop_delivery_areas USING GIST (geom);
CREATE INDEX IF NOT EXISTS shop_delivery_areas_created_at_idx ON public.shop_delivery_areas (created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_shop_delivery_area_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geom IS NULL THEN
    RAISE EXCEPTION 'Delivery area geometry is required';
  END IF;

  IF NOT ST_IsValid(NEW.geom) THEN
    RAISE EXCEPTION 'Delivery area geometry is invalid: %', ST_IsValidReason(NEW.geom);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shop_delivery_areas existing
    WHERE existing.shop_id = NEW.shop_id
      AND (NEW.id IS NULL OR existing.id <> NEW.id)
      AND ST_Intersects(existing.geom, NEW.geom)
  ) THEN
    RAISE EXCEPTION 'Delivery areas cannot overlap for the same shop.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_delivery_areas_prevent_overlap
  BEFORE INSERT OR UPDATE ON public.shop_delivery_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_shop_delivery_area_overlap();

ALTER TABLE public.shop_delivery_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view delivery areas"
  ON public.shop_delivery_areas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_areas.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can insert delivery areas"
  ON public.shop_delivery_areas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_areas.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update delivery areas"
  ON public.shop_delivery_areas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_areas.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_areas.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can delete delivery areas"
  ON public.shop_delivery_areas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops
      JOIN public.merchant_accounts ON merchant_accounts.id = shops.merchant_id
      WHERE shops.id = shop_delivery_areas.shop_id
        AND merchant_accounts.user_id = auth.uid()
    )
  );

CREATE TRIGGER shop_delivery_areas_touch
  BEFORE UPDATE ON public.shop_delivery_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE VIEW public.shop_delivery_areas_view AS
SELECT
  id,
  shop_id,
  label,
  ST_AsGeoJSON(geom) AS geom_geojson,
  created_at,
  updated_at
FROM public.shop_delivery_areas;

GRANT SELECT ON public.shop_delivery_areas_view TO authenticated;
GRANT SELECT ON public.shop_delivery_areas_view TO service_role;

