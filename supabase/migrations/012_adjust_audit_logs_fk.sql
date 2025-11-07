-- Allow audit logs to persist after item deletion

ALTER TABLE public.audit_logs
  ALTER COLUMN merchant_item_id DROP NOT NULL;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_merchant_item_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_merchant_item_id_fkey
    FOREIGN KEY (merchant_item_id)
    REFERENCES public.merchant_items (id)
    ON DELETE SET NULL;


