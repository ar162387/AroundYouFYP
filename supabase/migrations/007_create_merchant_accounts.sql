-- Create merchant_accounts table for merchant registration and verification
-- Each user can have one merchant account with shop type and verification status

CREATE TABLE IF NOT EXISTS public.merchant_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_type TEXT NOT NULL CHECK (shop_type IN ('grocery', 'meat', 'vegetable', 'mart', 'other')),
  number_of_shops TEXT NOT NULL CHECK (number_of_shops IN ('1', '2', '3+')),
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none', 'pending', 'verified')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Ensure one merchant account per user
  CONSTRAINT unique_user_merchant_account UNIQUE (user_id)
);

-- Index for faster queries
CREATE INDEX idx_merchant_accounts_user_id ON public.merchant_accounts(user_id);
CREATE INDEX idx_merchant_accounts_status ON public.merchant_accounts(status);
CREATE INDEX idx_merchant_accounts_created_at ON public.merchant_accounts(created_at DESC);

-- Enable RLS
ALTER TABLE public.merchant_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own merchant account
CREATE POLICY "Users can view their own merchant account"
  ON public.merchant_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own merchant account
CREATE POLICY "Users can insert their own merchant account"
  ON public.merchant_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own merchant account
CREATE POLICY "Users can update their own merchant account"
  ON public.merchant_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_merchant_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_merchant_accounts_updated_at
  BEFORE UPDATE ON public.merchant_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_accounts_updated_at();

COMMENT ON TABLE public.merchant_accounts IS 'Stores merchant account information including shop type and verification status';
COMMENT ON COLUMN public.merchant_accounts.shop_type IS 'Type of shop: grocery, meat, vegetable, mart, or other';
COMMENT ON COLUMN public.merchant_accounts.number_of_shops IS 'Number of shops: 1, 2, or 3+';
COMMENT ON COLUMN public.merchant_accounts.status IS 'Verification status: none, pending, or verified';

