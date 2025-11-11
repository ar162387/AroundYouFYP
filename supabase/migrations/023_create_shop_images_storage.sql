-- Create shop-images storage bucket and RLS policies
-- This allows merchants to upload shop images

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-images',
  'shop-images',
  true, -- Public bucket so images can be accessed via public URL
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view shop images" ON storage.objects;

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload images to shop-images bucket
-- Simplified: Allow any authenticated user to upload to shop-images bucket
CREATE POLICY "Authenticated users can upload shop images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shop-images');

-- Policy: Allow authenticated users to update images in shop-images bucket
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

