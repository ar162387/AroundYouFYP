-- Add DELETE RLS policy for user_profiles
-- Allows consumers to delete their own profile, but only if they don't have a merchant account
-- This ensures merchants must delete their merchant account first before deleting their consumer account

-- Users can delete their own profile only if they don't have a merchant account
CREATE POLICY "Users can delete their own profile if no merchant account"
  ON public.user_profiles
  FOR DELETE
  USING (
    auth.uid() = id
    AND NOT EXISTS (
      SELECT 1
      FROM public.merchant_accounts
      WHERE merchant_accounts.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can delete their own profile if no merchant account" ON public.user_profiles IS 
  'Allows users to delete their own consumer profile, but only if they do not have a merchant account. Merchants must delete their merchant account first before they can delete their consumer account.';

