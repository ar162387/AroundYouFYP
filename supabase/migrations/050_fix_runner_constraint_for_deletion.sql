-- Fix runner_required_for_delivery constraint to allow NULL for delivered orders
-- This allows deletion of shops and delivery runners even when there are delivered orders
-- The constraint will still require runner_id for 'out_for_delivery' orders (active deliveries)

-- ============================================================================
-- MODIFY CONSTRAINT TO ALLOW NULL FOR DELIVERED ORDERS
-- ============================================================================

-- Step 1: Drop the existing constraint
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS runner_required_for_delivery;

-- Step 2: Create new constraint that only requires runner_id for 'out_for_delivery' status
-- Delivered orders can have NULL runner_id (historical records)
ALTER TABLE public.orders
  ADD CONSTRAINT runner_required_for_delivery CHECK (
    (status != 'out_for_delivery') OR 
    delivery_runner_id IS NOT NULL
  );

-- Add comment explaining the change
COMMENT ON CONSTRAINT runner_required_for_delivery ON public.orders IS 
  'Requires delivery_runner_id for out_for_delivery orders. Delivered orders can have NULL runner_id to allow shop/runner deletion while preserving order history.';

