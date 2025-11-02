# Disable Email Confirmation for Development

## Problem
Users can't login because they get "email not confirmed" error, even though they just signed up.

## Solution: Disable Email Confirmation (Recommended for Development)

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** > **Providers** > **Email**
3. Toggle OFF **"Enable email confirmations"**
4. Save changes

After this, new signups will be automatically confirmed and can log in immediately.

## Alternative: Manually Confirm Existing Users

If you want to keep email confirmation enabled but need to confirm existing users manually, run this SQL in Supabase SQL Editor:

```sql
-- Manually confirm all existing users
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- This confirms all users who haven't confirmed their email yet
```

## For Production

In production, you should keep email confirmation enabled for security. Users will receive an email with a confirmation link that they need to click before they can sign in.

