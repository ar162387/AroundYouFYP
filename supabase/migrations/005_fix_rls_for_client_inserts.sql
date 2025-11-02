-- Fix RLS policy for client-side inserts (fallback scenario)
-- Reference: 004_clean_slate_rebuild.sql
-- Problem: When trigger is delayed or fails, client-side fallback insert is blocked by RLS
-- Solution: Create a SECURITY DEFINER function for client-side profile creation

-- ============================================================================
-- STEP 1: Create a function that allows secure profile creation from client
-- ============================================================================
-- This function can be called from the client after signup to ensure profile exists
-- It bypasses RLS because it's SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_user_profile_if_not_exists(
  user_id UUID,
  user_email TEXT,
  user_name TEXT DEFAULT NULL,
  user_role TEXT DEFAULT 'consumer'
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name, role)
  VALUES (user_id, user_email, user_name, user_role)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    role = COALESCE(EXCLUDED.role, user_profiles.role);
END;
$$;

-- ============================================================================
-- STEP 2: Grant execute permission to authenticated users
-- ============================================================================
-- This allows any authenticated user to call the function
-- The function itself enforces that they can only create/update their own profile
GRANT EXECUTE ON FUNCTION public.create_user_profile_if_not_exists TO authenticated;

-- ============================================================================
-- STEP 3: Add a check in the function to ensure users can only create their own profile
-- ============================================================================
-- Actually, let's make the function safer - it should check auth.uid()
CREATE OR REPLACE FUNCTION public.create_user_profile_if_not_exists(
  user_id UUID,
  user_email TEXT,
  user_name TEXT DEFAULT NULL,
  user_role TEXT DEFAULT 'consumer'
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure the user can only create/update their own profile
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'Cannot create profile for another user';
  END IF;

  INSERT INTO public.user_profiles (id, email, name, role)
  VALUES (user_id, user_email, user_name, user_role)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    role = COALESCE(EXCLUDED.role, user_profiles.role);
END;
$$;

-- ============================================================================
-- ALTERNATIVE: Update the INSERT policy to be more permissive for new signups
-- ============================================================================
-- Actually, the real issue might be that when we try to insert from client,
-- the user might not have a fully established session yet.
-- Let's also update the trigger function to ensure it works properly.

-- Verify the trigger function is correct
-- It should already be SECURITY DEFINER, but let's make sure it has proper permissions
-- The function in 004 should work, but let's ensure grants are correct

-- The issue: Client-side inserts require auth.uid() = id
-- But immediately after signup, the session might not be fully propagated
-- Solution: Use the SECURITY DEFINER function instead of direct inserts

