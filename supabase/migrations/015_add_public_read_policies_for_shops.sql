-- Add public read policies for shops and delivery areas
-- This allows both authenticated and unauthenticated users to view shops
-- and check delivery area coverage

-- Allow anyone to view shops (for consumer app)
CREATE POLICY "Anyone can view shops"
  ON public.shops
  FOR SELECT
  USING (true);

-- Allow anyone to view delivery areas (for consumer app to check coverage)
CREATE POLICY "Anyone can view delivery areas"
  ON public.shop_delivery_areas
  FOR SELECT
  USING (true);

-- Grant SELECT on view to anon role
GRANT SELECT ON public.shop_delivery_areas_view TO anon;

-- Create function to find shops by location (point within delivery area)
CREATE OR REPLACE FUNCTION public.find_shops_by_location(
  point_wkt TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  image_url TEXT,
  tags TEXT[],
  address TEXT,
  is_open BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    s.id,
    s.name,
    s.image_url,
    s.tags,
    s.address,
    s.is_open,
    s.created_at
  FROM public.shops s
  INNER JOIN public.shop_delivery_areas sda ON sda.shop_id = s.id
  WHERE s.is_open = true
    AND ST_Contains(sda.geom, ST_GeomFromText(point_wkt, 4326))
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.find_shops_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.find_shops_by_location(TEXT) TO authenticated;

