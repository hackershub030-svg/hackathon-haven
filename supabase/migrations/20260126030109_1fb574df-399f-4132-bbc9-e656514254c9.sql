-- Create project_votes table for upvoting system
CREATE TABLE public.project_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can view votes
CREATE POLICY "Anyone can view votes"
  ON public.project_votes
  FOR SELECT
  USING (true);

-- Authenticated users can vote
CREATE POLICY "Authenticated users can vote"
  ON public.project_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own votes
CREATE POLICY "Users can remove own votes"
  ON public.project_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage policy for project screenshots
CREATE POLICY "Users can upload project screenshots"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'project-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view project assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'project-assets');

CREATE POLICY "Users can update own project assets"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own project assets"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1]);