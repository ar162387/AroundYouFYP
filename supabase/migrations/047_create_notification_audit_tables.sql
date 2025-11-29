-- ============================================================================
-- NOTIFICATION AUDIT TABLES
-- ============================================================================
-- Creates tables for webhook idempotency, dead-letter queue, and audit logging
-- ============================================================================

-- Table to track processed webhooks (idempotency)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE, -- Composite: order_id + event_type + timestamp
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_webhook_event UNIQUE (event_id)
);

-- Index for faster lookups
CREATE INDEX idx_webhook_events_order_id ON public.webhook_events(order_id);
CREATE INDEX idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access (Edge Functions use service role)
CREATE POLICY "Service role can manage webhook events"
  ON public.webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Dead-letter queue for failed webhook processing
CREATE TABLE IF NOT EXISTS public.webhook_dead_letters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for dead-letter queue
CREATE INDEX idx_webhook_dead_letters_order_id ON public.webhook_dead_letters(order_id);
CREATE INDEX idx_webhook_dead_letters_created_at ON public.webhook_dead_letters(created_at);
CREATE INDEX idx_webhook_dead_letters_retry_count ON public.webhook_dead_letters(retry_count);

-- Enable RLS
ALTER TABLE public.webhook_dead_letters ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access
CREATE POLICY "Service role can manage dead letters"
  ON public.webhook_dead_letters
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Notification audit log
CREATE TABLE IF NOT EXISTS public.notification_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('consumer', 'merchant')),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  fcm_token TEXT,
  platform TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for audit log
CREATE INDEX idx_notification_audit_order_id ON public.notification_audit_log(order_id);
CREATE INDEX idx_notification_audit_user_id ON public.notification_audit_log(user_id);
CREATE INDEX idx_notification_audit_status ON public.notification_audit_log(status);
CREATE INDEX idx_notification_audit_created_at ON public.notification_audit_log(created_at);

-- Enable RLS
ALTER TABLE public.notification_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can insert, users can view their own logs
CREATE POLICY "Service role can manage audit logs"
  ON public.notification_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view their own notification logs"
  ON public.notification_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.webhook_events IS 'Tracks processed webhook events for idempotency';
COMMENT ON TABLE public.webhook_dead_letters IS 'Stores failed webhook payloads for manual inspection and retry';
COMMENT ON TABLE public.notification_audit_log IS 'Audit log of all notification attempts for debugging and compliance';

