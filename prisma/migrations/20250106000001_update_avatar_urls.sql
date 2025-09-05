-- Migration to update existing avatar_url values to store only filenames
-- This migration extracts filenames from full URLs and updates the avatar_url field

-- Example: Update full URLs to just filenames
-- Before: http://127.0.0.1:54321/storage/v1/object/public/avatars/profile_1757044376824_v074xsd4kok.jpg
-- After: profile_1757044376824_v074xsd4kok.jpg

UPDATE profiles 
SET avatar_url = CASE 
  WHEN avatar_url IS NOT NULL AND avatar_url LIKE '%/avatars/%' THEN 
    SUBSTRING(avatar_url FROM 'avatars/([^/]+)$')
  ELSE avatar_url
END
WHERE avatar_url IS NOT NULL;
