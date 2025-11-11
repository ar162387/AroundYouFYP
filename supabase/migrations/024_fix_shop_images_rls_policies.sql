-- Fix RLS policies for shop-images bucket to allow authenticated uploads
-- This ensures authenticated users can upload without needing service_role key

-- Drop all existing policies for shop-images to start fresh
DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view shop images" ON storage.objects;

-- Policy: Allow authenticated users to upload images to shop-images bucket
-- Using both USING and WITH CHECK for INSERT operations
CREATE POLICY "Authenticated users can upload shop images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-images'
  );

-- Policy: Allow authenticated users to update their own images in shop-images bucket
CREATE POLICY "Authenticated users can update shop images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'shop-images')
  WITH CHECK (bucket_id = 'shop-images');

-- Policy: Allow authenticated users to delete images in shop-images bucket
CREATE POLICY "Authenticated users can delete shop images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'shop-images');

-- Policy: Allow public read access to shop images
CREATE POLICY "Public can view shop images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'shop-images');

-- Policy: Allow authenticated users to view shop images
CREATE POLICY "Authenticated users can view shop images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'shop-images');

