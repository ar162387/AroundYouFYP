-- Update find_shops_by_location to only return shops from verified merchants
-- This ensures unverified merchants' shops are not visible to consumers

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
  opening_hours JSONB,
  holidays JSONB,
  open_status_mode TEXT,
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
    public.compute_shop_is_open(s) AS is_open,  -- Use computed real-time status
    s.created_at,
    s.shop_type,
    s.opening_hours,
    s.holidays,
    s.open_status_mode,
    COALESCE(
      (SELECT COUNT(*)::BIGINT
       FROM public.orders o
       WHERE o.shop_id = s.id
         AND o.status = 'delivered'
      ),
      0
    ) AS delivered_orders_count
  FROM public.shops s
  INNER JOIN public.shop_delivery_areas sda ON sda.shop_id = s.id
  INNER JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
  WHERE ST_Contains(sda.geom, ST_GeomFromText(point_wkt, 4326))
    AND ma.status = 'verified'  -- Only show shops from verified merchants
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

