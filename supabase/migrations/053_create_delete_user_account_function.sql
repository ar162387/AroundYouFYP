-- Create a function to delete user account and all related consumer data
-- This function handles cascading deletion of all consumer-related data
-- It can only be called by the user themselves and only if they don't have a merchant account

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Check if merchant account exists - if it does, prevent deletion
  IF EXISTS (
    SELECT 1
    FROM public.merchant_accounts
    WHERE user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot delete consumer account. Please delete your merchant account first.';
  END IF;

  -- Delete user preferences and embeddings (CASCADE will handle embeddings)
  DELETE FROM public.user_preferences
  WHERE user_id = current_user_id;

  -- Delete notification preferences
  DELETE FROM public.notification_preferences
  WHERE user_id = current_user_id;

  -- Delete device tokens
  DELETE FROM public.device_tokens
  WHERE user_id = current_user_id;

  -- Delete notification audit logs
  DELETE FROM public.notification_audit_log
  WHERE user_id = current_user_id;

  -- Delete reviews
  DELETE FROM public.reviews
  WHERE user_id = current_user_id;

  -- For orders, we can't delete them due to RESTRICT constraint on user_id
  -- Orders also have RESTRICT on consumer_address_id, so we can't delete addresses referenced by orders
  -- We'll only delete addresses that are NOT referenced by any orders
  -- Addresses referenced by orders will remain for historical record keeping
  DELETE FROM public.consumer_addresses
  WHERE user_id = current_user_id
    AND id NOT IN (
      SELECT DISTINCT consumer_address_id
      FROM public.orders
      WHERE consumer_address_id IS NOT NULL
    );

  -- Finally, delete the user profile
  DELETE FROM public.user_profiles
  WHERE id = current_user_id;

  -- Note: The auth.users record will remain in Supabase Auth
  -- This is by design - auth.users deletion should be handled separately
  -- through Supabase Auth API or dashboard for security reasons
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

COMMENT ON FUNCTION public.delete_user_account() IS 
  'Deletes the current user''s consumer account and all related data. Can only be called by the authenticated user and only if they do not have a merchant account. Orders are preserved for historical records due to RESTRICT constraint.';

