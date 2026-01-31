-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Add avatar_url column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add payment_email_locked column to profiles (locks email after first save)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payment_email_locked boolean DEFAULT false;