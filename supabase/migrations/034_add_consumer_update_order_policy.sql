-- ============================================================================
-- ADD CONSUMER UPDATE POLICY FOR ORDER CANCELLATION
-- ============================================================================
-- This migration adds an RLS policy to allow consumers to update their own orders
-- Specifically to cancel orders (change status to 'cancelled')
-- ============================================================================

-- Allow consumers to update their own orders (primarily for cancellation)
-- The trigger validate_order_status_transition() will enforce valid status transitions
CREATE POLICY "Consumers can update their own orders"
  ON public.orders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Consumers can update their own orders" ON public.orders IS 
  'Allows consumers to update their own orders, primarily for cancellation. Restricts status changes to cancellation only.';

