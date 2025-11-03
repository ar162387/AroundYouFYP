-- Create consumer_addresses table for saving user delivery addresses
-- Users can have multiple addresses with optional titles (Home, Office) and landmarks

CREATE TABLE IF NOT EXISTS public.consumer_addresses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Address title (optional, unique per user): 'home', 'office', etc.
  title TEXT CHECK (title IN ('home', 'office')),
  -- Full reverse geocoded address
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT,
  -- Coordinates
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  -- Optional landmark/clarification
  landmark TEXT,
  -- Full formatted address for reference
  formatted_address TEXT,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Ensure unique title per user (only if title is not null)
  CONSTRAINT unique_user_title UNIQUE (user_id, title) DEFERRABLE INITIALLY DEFERRED
);

-- Index for faster queries
CREATE INDEX idx_consumer_addresses_user_id ON public.consumer_addresses(user_id);
CREATE INDEX idx_consumer_addresses_created_at ON public.consumer_addresses(created_at DESC);

-- Enable RLS
ALTER TABLE public.consumer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own addresses
CREATE POLICY "Users can view their own addresses"
  ON public.consumer_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own addresses
CREATE POLICY "Users can insert their own addresses"
  ON public.consumer_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own addresses
CREATE POLICY "Users can update their own addresses"
  ON public.consumer_addresses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own addresses
CREATE POLICY "Users can delete their own addresses"
  ON public.consumer_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consumer_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_consumer_addresses_updated_at
  BEFORE UPDATE ON public.consumer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_consumer_addresses_updated_at();

-- Add constraint to allow only one address per title per user
-- This is handled by the unique constraint, but we need to handle NULL titles
-- PostgreSQL unique constraints treat NULL values as distinct, so multiple NULL titles are allowed
-- But we want only one address with title='home' and one with title='office' per user

COMMENT ON TABLE public.consumer_addresses IS 'Stores delivery addresses for consumers';
COMMENT ON COLUMN public.consumer_addresses.title IS 'Optional address title: home or office (unique per user)';
COMMENT ON COLUMN public.consumer_addresses.street_address IS 'Street address without city/region';
COMMENT ON COLUMN public.consumer_addresses.landmark IS 'Optional landmark or flat/house number for clarification';

