-- Allow safe deletion of merchant_items while preserving order history
-- When a shop is deleted, merchant_items are cascade deleted.
-- Order items already have snapshot data (item_name, item_description, etc.)
-- so we can safely set merchant_item_id to NULL to preserve order history.

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_merchant_item_id_fkey;

-- Step 2: Make merchant_item_id nullable (to allow SET NULL on delete)
ALTER TABLE public.order_items
  ALTER COLUMN merchant_item_id DROP NOT NULL;

-- Step 3: Recreate the foreign key constraint with ON DELETE SET NULL
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_merchant_item_id_fkey
  FOREIGN KEY (merchant_item_id)
  REFERENCES public.merchant_items(id)
  ON DELETE SET NULL;

-- Step 4: Update the index to handle NULL values (partial index for non-null merchant_item_id)
CREATE INDEX IF NOT EXISTS idx_order_items_merchant_item_id_not_null 
  ON public.order_items(merchant_item_id) 
  WHERE merchant_item_id IS NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN public.order_items.merchant_item_id IS 
  'Reference to merchant item. Can be NULL if item was deleted (order history is preserved with snapshot data).';

