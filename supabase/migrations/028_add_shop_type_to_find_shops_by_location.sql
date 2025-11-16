-- Add shop_type and delivered_orders_count to find_shops_by_location function
-- This allows displaying shop type and total delivered orders in the consumer app

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
  created_at TIMESTAMPTZ,
  shop_type TEXT,
  delivered_orders_count BIGINT
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
    s.created_at,
    s.shop_type,
    COALESCE(
      (SELECT COUNT(*)::BIGINT 
       FROM public.orders o 
       WHERE o.shop_id = s.id 
       AND o.status = 'delivered'),
      0::BIGINT
    ) AS delivered_orders_count
  FROM public.shops s
  INNER JOIN public.shop_delivery_areas sda ON sda.shop_id = s.id
  WHERE s.is_open = true
    AND ST_Contains(sda.geom, ST_GeomFromText(point_wkt, 4326))
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

