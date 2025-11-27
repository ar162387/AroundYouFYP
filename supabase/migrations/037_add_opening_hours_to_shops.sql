-- Add opening hours, holidays, and manual open/close mode to shops

-- JSONB structure (for documentation purposes, not enforced by DB):
-- opening_hours: {
--   "monday":   { "enabled": true,  "open": "09:00", "close": "21:00" },
--   "tuesday":  { "enabled": true,  "open": "09:00", "close": "21:00" },
--   "wednesday":{ "enabled": true,  "open": "09:00", "close": "21:00" },
--   "thursday": { "enabled": true,  "open": "09:00", "close": "21:00" },
--   "friday":   { "enabled": true,  "open": "09:00", "close": "21:00" },
--   "saturday": { "enabled": true,  "open": "09:00", "close": "21:00" },
--   "sunday":   { "enabled": false, "open": "09:00", "close": "21:00" }
-- }
--
-- holidays: [
--   { "date": "2024-06-01", "description": "Eid Holiday" },
--   { "date": "2024-08-14", "description": "Independence Day" }
-- ]
--
-- open_status_mode:
--   'auto'          -> rely on schedule/holidays
--   'manual_open'   -> force open
--   'manual_closed' -> force closed

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS opening_hours jsonb;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS holidays jsonb;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS open_status_mode text NOT NULL DEFAULT 'auto';

ALTER TABLE public.shops
  ADD CONSTRAINT shops_open_status_mode_check
  CHECK (open_status_mode IN ('auto', 'manual_open', 'manual_closed'));


