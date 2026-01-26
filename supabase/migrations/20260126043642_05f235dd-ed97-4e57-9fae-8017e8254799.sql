-- Add presentation_url column to applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS presentation_url text;

-- Create storage bucket for team presentations
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-presentations', 'team-presentations', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload presentations
CREATE POLICY "Users can upload their own presentations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'team-presentations' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to presentations
CREATE POLICY "Public can read presentations"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-presentations');

-- Allow users to update their own presentations
CREATE POLICY "Users can update their own presentations"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'team-presentations' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own presentations
CREATE POLICY "Users can delete their own presentations"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'team-presentations' AND auth.uid()::text = (storage.foldername(name))[1]);