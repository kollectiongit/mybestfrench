-- Enable RLS on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to upload files to avatars bucket
CREATE POLICY "Allow authenticated uploads to avatars bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Policy for authenticated users to upload files to images bucket
CREATE POLICY "Allow authenticated uploads to images bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

-- Policy for authenticated users to upload files to audio bucket
CREATE POLICY "Allow authenticated uploads to audio bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio');

-- Policy for public access to read files from avatars bucket
CREATE POLICY "Allow public access to avatars bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy for public access to read files from images bucket
CREATE POLICY "Allow public access to images bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');

-- Policy for public access to read files from audio bucket
CREATE POLICY "Allow public access to audio bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'audio');

-- Policy for authenticated users to update files in avatars bucket
CREATE POLICY "Allow authenticated updates to avatars bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- Policy for authenticated users to update files in images bucket
CREATE POLICY "Allow authenticated updates to images bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'images')
WITH CHECK (bucket_id = 'images');

-- Policy for authenticated users to update files in audio bucket
CREATE POLICY "Allow authenticated updates to audio bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'audio')
WITH CHECK (bucket_id = 'audio');

-- Policy for authenticated users to delete files from avatars bucket
CREATE POLICY "Allow authenticated deletes from avatars bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- Policy for authenticated users to delete files from images bucket
CREATE POLICY "Allow authenticated deletes from images bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'images');

-- Policy for authenticated users to delete files from audio bucket
CREATE POLICY "Allow authenticated deletes from audio bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'audio');
