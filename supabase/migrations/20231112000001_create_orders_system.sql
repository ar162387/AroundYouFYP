-- ============================================================================
-- ORDERS SYSTEM MIGRATION
-- ============================================================================
-- This migration creates a comprehensive order management system with:
-- - Real-time order tracking with multiple states
-- - Automatic timing calculations for each stage
-- - Order item snapshots to preserve pricing at order time
-- - Analytics tracking for sold items
-- - Proper RLS policies for consumer and merchant access
-- ============================================================================

-- Create enum for order status
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed', 
  'out_for_delivery',
  'delivered',
  'cancelled'
);

-- Create enum for payment methods
CREATE TYPE payment_method AS ENUM (
  'cash',
  'card',
  'wallet'
);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  
  -- References
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  consumer_address_id UUID NOT NULL REFERENCES public.consumer_addresses(id) ON DELETE RESTRICT,
  delivery_runner_id UUID REFERENCES public.delivery_runners(id) ON DELETE SET NULL,
  
  -- Status
  status order_status NOT NULL DEFAULT 'pending',
  
  -- Pricing (all in cents for precision)
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  surcharge_cents INTEGER DEFAULT 0 CHECK (surcharge_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  
  -- Payment
  payment_method payment_method NOT NULL DEFAULT 'cash',
  
  -- Customer notes
  special_instructions TEXT,
  
  -- Status timestamps (for precise tracking)
  placed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  confirmed_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Calculated durations (in seconds)
  confirmation_time_seconds INTEGER CHECK (confirmation_time_seconds >= 0),
  preparation_time_seconds INTEGER CHECK (preparation_time_seconds >= 0),
  delivery_time_seconds INTEGER CHECK (delivery_time_seconds >= 0),
  
  -- Cancellation tracking
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Address snapshot (preserve address at order time)
  delivery_address JSONB NOT NULL,
  
  -- Customer snapshot (preserve at order time)
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  
  -- Constraints
  CONSTRAINT valid_status_timestamps CHECK (
    (status = 'pending' AND confirmed_at IS NULL) OR
    (status = 'confirmed' AND confirmed_at IS NOT NULL) OR
    (status = 'out_for_delivery' AND confirmed_at IS NOT NULL AND out_for_delivery_at IS NOT NULL) OR
    (status = 'delivered' AND confirmed_at IS NOT NULL AND out_for_delivery_at IS NOT NULL AND delivered_at IS NOT NULL) OR
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT runner_required_for_delivery CHECK (
    (status != 'out_for_delivery' AND status != 'delivered') OR 
    delivery_runner_id IS NOT NULL
  )
);

-- Indexes for performance
CREATE INDEX idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX idx_orders_shop_status ON public.orders(shop_id, status);
CREATE INDEX idx_orders_runner_id ON public.orders(delivery_runner_id) WHERE delivery_runner_id IS NOT NULL;
CREATE INDEX idx_orders_order_number ON public.orders(order_number);

-- ============================================================================
-- ORDER ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_item_id UUID NOT NULL REFERENCES public.merchant_items(id) ON DELETE RESTRICT,
  
  -- Snapshot data (preserve at order time)
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_image_url TEXT,
  item_price_cents INTEGER NOT NULL CHECK (item_price_cents >= 0),
  
  -- Order specifics
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  
  -- Constraints
  CONSTRAINT valid_subtotal CHECK (subtotal_cents = item_price_cents * quantity)
);

-- Indexes
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_merchant_item_id ON public.order_items(merchant_item_id);

-- ============================================================================
-- ADD ANALYTICS FIELD TO MERCHANT ITEMS
-- ============================================================================
ALTER TABLE public.merchant_items 
  ADD COLUMN IF NOT EXISTS times_sold INTEGER NOT NULL DEFAULT 0 CHECK (times_sold >= 0),
  ADD COLUMN IF NOT EXISTS total_revenue_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_revenue_cents >= 0);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  sequence_num INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  date_part := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  
  LOOP
    -- Get the count of orders today and add 1
    SELECT COUNT(*) + 1 INTO sequence_num
    FROM public.orders
    WHERE order_number LIKE 'ORD-' || date_part || '-%';
    
    new_order_number := 'ORD-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    -- Check if this number already exists
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = new_order_number) THEN
      RETURN new_order_number;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      -- Fallback to UUID-based number
      RETURN 'ORD-' || date_part || '-' || substr(md5(random()::text), 1, 6);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to set order number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate order timings
CREATE OR REPLACE FUNCTION calculate_order_timings()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate confirmation time
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' AND NEW.confirmed_at IS NOT NULL THEN
    NEW.confirmation_time_seconds := EXTRACT(EPOCH FROM (NEW.confirmed_at - NEW.placed_at))::INTEGER;
  END IF;
  
  -- Calculate preparation time
  IF NEW.status = 'out_for_delivery' AND OLD.status = 'confirmed' AND NEW.out_for_delivery_at IS NOT NULL THEN
    NEW.preparation_time_seconds := EXTRACT(EPOCH FROM (NEW.out_for_delivery_at - NEW.confirmed_at))::INTEGER;
  END IF;
  
  -- Calculate delivery time
  IF NEW.status = 'delivered' AND OLD.status = 'out_for_delivery' AND NEW.delivered_at IS NOT NULL THEN
    NEW.delivery_time_seconds := EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.out_for_delivery_at))::INTEGER;
  END IF;
  
  -- Handle cancellation - preserve existing timings
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at := timezone('utc', now());
    -- Preserve any timings that were already calculated
    NEW.confirmation_time_seconds := OLD.confirmation_time_seconds;
    NEW.preparation_time_seconds := OLD.preparation_time_seconds;
    NEW.delivery_time_seconds := OLD.delivery_time_seconds;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update merchant item analytics on order delivery
CREATE OR REPLACE FUNCTION update_item_analytics_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment when order transitions to delivered
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Update times_sold and revenue for each item in the order
    UPDATE public.merchant_items mi
    SET 
      times_sold = times_sold + oi.quantity,
      total_revenue_cents = total_revenue_cents + oi.subtotal_cents
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id 
      AND oi.merchant_item_id = mi.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Touch updated_at on orders
CREATE OR REPLACE FUNCTION touch_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Set order number on insert
CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Validate status transitions
CREATE TRIGGER validate_status_transition_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_status_transition();

-- Calculate timings
CREATE TRIGGER calculate_timings_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_timings();

-- Update item analytics on delivery
CREATE TRIGGER update_analytics_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
  EXECUTE FUNCTION update_item_analytics_on_delivery();

-- Touch updated_at
CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION touch_orders_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders policies for consumers
CREATE POLICY "Consumers can view their own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Consumers can insert their own orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Orders policies for merchants
CREATE POLICY "Merchants can view orders for their shops"
  ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = orders.shop_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update orders for their shops"
  ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = orders.shop_id
        AND ma.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = orders.shop_id
        AND ma.user_id = auth.uid()
    )
  );

-- Order items policies for consumers
CREATE POLICY "Consumers can view their own order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Consumers can insert order items for their orders"
  ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
    )
  );

-- Order items policies for merchants
CREATE POLICY "Merchants can view order items for their shops"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.shops s ON s.id = o.shop_id
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE o.id = order_items.order_id
        AND ma.user_id = auth.uid()
    )
  );

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.orders IS 'Stores all orders with real-time status tracking and timing analytics';
COMMENT ON TABLE public.order_items IS 'Line items for orders with snapshot pricing at order time';
COMMENT ON COLUMN public.orders.order_number IS 'Unique human-readable order number (ORD-YYYYMMDD-NNNN)';
COMMENT ON COLUMN public.orders.delivery_address IS 'JSONB snapshot of consumer address at order time';
COMMENT ON COLUMN public.orders.confirmation_time_seconds IS 'Duration from placed to confirmed in seconds';
COMMENT ON COLUMN public.orders.preparation_time_seconds IS 'Duration from confirmed to out_for_delivery in seconds';
COMMENT ON COLUMN public.orders.delivery_time_seconds IS 'Duration from out_for_delivery to delivered in seconds';
COMMENT ON COLUMN public.merchant_items.times_sold IS 'Total number of times this item has been sold (incremented on order delivery)';
COMMENT ON COLUMN public.merchant_items.total_revenue_cents IS 'Total revenue generated from this item in cents';

