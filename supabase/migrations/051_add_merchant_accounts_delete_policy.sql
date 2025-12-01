-- Add DELETE RLS policy for merchant_accounts
-- Allows merchants to delete their own merchant account
-- This will cascade delete all related data (shops, items, etc.) due to ON DELETE CASCADE constraints

-- Users can delete their own merchant account
CREATE POLICY "Users can delete their own merchant account"
  ON public.merchant_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can delete their own merchant account" ON public.merchant_accounts IS 
  'Allows merchants to delete their own merchant account. This will cascade delete all related shops, items, and other merchant data due to foreign key constraints.';

