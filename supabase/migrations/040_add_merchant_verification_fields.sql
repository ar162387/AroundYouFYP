-- Add verification fields to merchant_accounts table
-- These fields are used for identity verification

ALTER TABLE public.merchant_accounts
ADD COLUMN IF NOT EXISTS name_as_per_cnic TEXT,
ADD COLUMN IF NOT EXISTS cnic TEXT,
ADD COLUMN IF NOT EXISTS cnic_expiry DATE;

-- Add index for faster queries on verification status
CREATE INDEX IF NOT EXISTS idx_merchant_accounts_verification_status 
ON public.merchant_accounts(status) 
WHERE status IN ('none', 'pending', 'verified');

-- Add comment for documentation
COMMENT ON COLUMN public.merchant_accounts.name_as_per_cnic IS 'Name as it appears on CNIC';
COMMENT ON COLUMN public.merchant_accounts.cnic IS 'CNIC number for identity verification';
COMMENT ON COLUMN public.merchant_accounts.cnic_expiry IS 'CNIC expiry date';

