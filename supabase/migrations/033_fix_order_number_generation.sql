-- ============================================================================
-- FIX ORDER NUMBER GENERATION - SIMPLE AND ROBUST
-- ============================================================================
-- This migration fixes order number generation to be race-condition safe
-- without requiring special permissions. Uses advisory locks for serialization.
-- ============================================================================

-- Drop and recreate the function with advisory locks for race condition safety
-- SECURITY DEFINER ensures it runs with function owner's permissions (bypasses RLS)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  date_part TEXT;
  sequence_num INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 20;
  attempt INTEGER := 0;
  lock_id BIGINT;
BEGIN
  date_part := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  
  -- Use an advisory lock to serialize order number generation per day
  -- This prevents race conditions when multiple orders are placed simultaneously
  lock_id := hashtext('order_number_' || date_part);
  
  -- Acquire advisory lock (blocks until available, releases on transaction commit)
  PERFORM pg_advisory_xact_lock(lock_id);
  
  LOOP
    -- Get the maximum sequence number for today and add 1
    -- The lock ensures only one transaction can execute this at a time
    SELECT COALESCE(MAX(
      CASE 
        WHEN order_number ~ '^ORD-[0-9]{8}-([0-9]+)$' THEN
          CAST(SUBSTRING(order_number FROM 'ORD-[0-9]{8}-([0-9]+)$') AS INTEGER)
        ELSE 0
      END
    ), 0) + 1 INTO sequence_num
    FROM public.orders
    WHERE order_number LIKE 'ORD-' || date_part || '-%';
    
    -- Generate order number with format: ORD-YYYYMMDD-NNNN
    new_order_number := 'ORD-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    -- Double-check if this number already exists (shouldn't happen with lock, but safety check)
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = new_order_number) THEN
      RETURN new_order_number;
    END IF;
    
    -- If somehow we got a duplicate (extremely rare with lock), increment and try again
    sequence_num := sequence_num + 1;
    attempt := attempt + 1;
    
    IF attempt >= max_attempts THEN
      -- Fallback to UUID-based number if we can't find a unique sequential number
      RETURN 'ORD-' || date_part || '-' || UPPER(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    END IF;
  END LOOP;
END;
$$;

-- Update the trigger function to ensure it works correctly
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION generate_order_number() IS 
  'Generates unique order numbers with format ORD-YYYYMMDD-NNNN. Uses advisory locks to prevent race conditions. Runs with SECURITY DEFINER to bypass RLS.';

-- Also ensure cancelled_at is set when order is cancelled (from migration 030 functionality)
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow any transition if inserting
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Define valid transitions
  IF OLD.status = 'pending' THEN
    IF NEW.status NOT IN ('confirmed', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
    END IF;
  ELSIF OLD.status = 'confirmed' THEN
    IF NEW.status NOT IN ('out_for_delivery', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from confirmed to %', NEW.status;
    END IF;
  ELSIF OLD.status = 'out_for_delivery' THEN
    IF NEW.status NOT IN ('delivered', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from out_for_delivery to %', NEW.status;
    END IF;
  ELSIF OLD.status IN ('delivered', 'cancelled') THEN
    -- Terminal states - no transitions allowed
    IF NEW.status != OLD.status THEN
      RAISE EXCEPTION 'Cannot change status from terminal state %', OLD.status;
    END IF;
  END IF;
  
  -- Set appropriate timestamp based on new status
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    NEW.confirmed_at := timezone('utc', now());
  ELSIF NEW.status = 'out_for_delivery' AND OLD.status = 'confirmed' THEN
    NEW.out_for_delivery_at := timezone('utc', now());
  ELSIF NEW.status = 'delivered' AND OLD.status = 'out_for_delivery' THEN
    NEW.delivered_at := timezone('utc', now());
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Set cancelled_at timestamp when order is cancelled
    NEW.cancelled_at := timezone('utc', now());
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_order_status_transition() IS 
  'Validates order status transitions and automatically sets appropriate timestamps (confirmed_at, out_for_delivery_at, delivered_at, cancelled_at) based on status changes.';

