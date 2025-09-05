-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public uploads to avatars bucket
CREATE POLICY "Allow public uploads to avatars" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars');

-- Allow public reads from avatars bucket
CREATE POLICY "Allow public reads from avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Allow public deletes from avatars bucket
CREATE POLICY "Allow public deletes from avatars" ON storage.objects
FOR DELETE USING (bucket_id = 'avatars');
