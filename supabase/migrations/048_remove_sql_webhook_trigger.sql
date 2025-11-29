-- ============================================================================
-- REMOVE SQL WEBHOOK TRIGGER (NO LONGER NEEDED)
-- ============================================================================
-- This migration removes the SQL trigger-based webhook system since we're
-- now using Supabase Database Webhooks (configured via Dashboard).
-- ============================================================================

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS order_notification_trigger ON public.orders;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.notify_order_status_change();

-- Note: The http extension may still be used by other parts of the system,
-- so we don't drop it. Only remove if you're sure nothing else uses it.
-- DROP EXTENSION IF EXISTS http CASCADE;

COMMENT ON SCHEMA public IS 'SQL trigger removed - using Database Webhooks instead (configure via Dashboard: Settings > Database > Webhooks)';

