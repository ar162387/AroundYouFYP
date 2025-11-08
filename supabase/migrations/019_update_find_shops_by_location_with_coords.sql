-- Update find_shops_by_location function to include shop coordinates
-- This allows calculating distance and delivery fees on the client side

CREATE OR REPLACE FUNCTION public.find_shops_by_location(
  point_wkt TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  image_url TEXT,
  tags TEXT[],
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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
    s.latitude,
    s.longitude,
    s.is_open,
    s.created_at
  FROM public.shops s
  INNER JOIN public.shop_delivery_areas sda ON sda.shop_id = s.id
  WHERE s.is_open = true
    AND ST_Contains(sda.geom, ST_GeomFromText(point_wkt, 4326))
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

