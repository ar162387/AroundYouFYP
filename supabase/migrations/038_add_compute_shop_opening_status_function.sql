-- Create function to compute real-time shop opening status
-- This function calculates if a shop should be open based on:
-- 1. Manual override mode (manual_open, manual_closed, auto)
-- 2. Custom holidays
-- 3. Opening hours schedule

CREATE OR REPLACE FUNCTION public.compute_shop_is_open(
  shop_record public.shops
)
RETURNS BOOLEAN AS $$
DECLARE
  mode_val TEXT;
  opening_hours_json JSONB;
  holidays_json JSONB;
  today_key TEXT;
  today_config JSONB;
  now_time TIME;
  open_time_str TEXT;
  close_time_str TEXT;
  open_time TIME;
  close_time TIME;
  today_date_str TEXT;
  holiday_record JSONB;
  is_enabled BOOLEAN;
BEGIN
  -- Get mode, default to 'auto'
  mode_val := COALESCE(shop_record.open_status_mode, 'auto');
  
  -- Manual overrides
  IF mode_val = 'manual_open' THEN
    RETURN TRUE;
  END IF;
  
  IF mode_val = 'manual_closed' THEN
    RETURN FALSE;
  END IF;
  
  -- Auto mode: check schedule
  opening_hours_json := shop_record.opening_hours;
  holidays_json := shop_record.holidays;
  
  -- No schedule means open by default
  IF opening_hours_json IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Get today's day of week (0=Sunday, 6=Saturday in PostgreSQL)
  -- Map to our day keys
  today_key := CASE EXTRACT(DOW FROM NOW())
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;
  
  -- Check for holiday
  today_date_str := TO_CHAR(NOW(), 'YYYY-MM-DD');
  IF holidays_json IS NOT NULL AND jsonb_typeof(holidays_json) = 'array' THEN
    SELECT h INTO holiday_record
    FROM jsonb_array_elements(holidays_json) AS h
    WHERE (h->>'date') = today_date_str
    LIMIT 1;
    
    IF holiday_record IS NOT NULL THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Get today's schedule using explicit path lookup with variable
  today_config := jsonb_extract_path(opening_hours_json, today_key);
  
  -- If no config for today, shop is closed
  IF today_config IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if enabled, handling NULL case
  is_enabled := COALESCE((today_config->>'enabled')::BOOLEAN, FALSE);
  IF NOT is_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Get open/close times
  open_time_str := today_config->>'open';
  close_time_str := today_config->>'close';
  
  IF open_time_str IS NULL OR close_time_str IS NULL THEN
    RETURN TRUE; -- Default to open if times are invalid
  END IF;
  
  -- Parse times (HH:MM format)
  BEGIN
    open_time := open_time_str::TIME;
    close_time := close_time_str::TIME;
  EXCEPTION WHEN OTHERS THEN
    RETURN TRUE; -- Default to open on parse error
  END;
  
  -- Get current time (using CURRENT_TIME to avoid variable name collision)
  now_time := CURRENT_TIME;
  
  -- Check if current time is within opening hours
  -- Handle case where close time is next day (e.g., 23:00 - 02:00)
  IF close_time > open_time THEN
    -- Normal case: same day
    RETURN now_time >= open_time AND now_time < close_time;
  ELSE
    -- Wrap-around case: spans midnight
    RETURN now_time >= open_time OR now_time < close_time;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a computed view or update the find_shops_by_location function
-- For now, let's update find_shops_by_location to use computed status
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
  WHERE ST_Contains(sda.geom, ST_GeomFromText(point_wkt, 4326))  -- Only filter by delivery area, show all shops regardless of open/closed status
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.compute_shop_is_open(public.shops) TO anon;
GRANT EXECUTE ON FUNCTION public.compute_shop_is_open(public.shops) TO authenticated;

