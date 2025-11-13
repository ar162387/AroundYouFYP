-- ============================================================================
-- ROLLBACK ORDERS SYSTEM
-- ============================================================================
-- This migration safely rolls back the orders system
-- Run this if you need to undo the orders system migration
-- ============================================================================

-- Disable realtime
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.orders;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.order_items;

-- Drop policies
DROP POLICY IF EXISTS "Consumers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Consumers can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Merchants can view orders for their shops" ON public.orders;
DROP POLICY IF EXISTS "Merchants can update orders for their shops" ON public.orders;
DROP POLICY IF EXISTS "Consumers can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Consumers can insert order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Merchants can view order items for their shops" ON public.order_items;

-- Drop triggers
DROP TRIGGER IF EXISTS set_order_number_trigger ON public.orders;
DROP TRIGGER IF EXISTS validate_status_transition_trigger ON public.orders;
DROP TRIGGER IF EXISTS calculate_timings_trigger ON public.orders;
DROP TRIGGER IF EXISTS update_analytics_trigger ON public.orders;
DROP TRIGGER IF EXISTS orders_touch_updated_at ON public.orders;

-- Drop functions
DROP FUNCTION IF EXISTS generate_order_number();
DROP FUNCTION IF EXISTS set_order_number();
DROP FUNCTION IF EXISTS calculate_order_timings();
DROP FUNCTION IF EXISTS update_item_analytics_on_delivery();
DROP FUNCTION IF EXISTS validate_order_status_transition();
DROP FUNCTION IF EXISTS touch_orders_updated_at();

-- Remove analytics columns from merchant_items
ALTER TABLE public.merchant_items 
  DROP COLUMN IF EXISTS times_sold,
  DROP COLUMN IF EXISTS total_revenue_cents;

-- Drop tables
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;

-- Drop enums
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS order_status;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Orders system rollback completed successfully';
END $$;

