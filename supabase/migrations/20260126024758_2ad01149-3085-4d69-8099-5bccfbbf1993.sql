-- Add is_gallery_public column to hackathons table for organizer control
ALTER TABLE public.hackathons
ADD COLUMN is_gallery_public boolean DEFAULT false;

-- Update RLS policy for projects to allow team members to insert if gallery is public
-- First, create a helper function to check if gallery is public
CREATE OR REPLACE FUNCTION public.is_gallery_public(_hackathon_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_gallery_public, false)
  FROM public.hackathons
  WHERE id = _hackathon_id
$$;

-- Create a function to check if user already has a project for this hackathon
CREATE OR REPLACE FUNCTION public.user_has_project_for_hackathon(_user_id uuid, _hackathon_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE hackathon_id = _hackathon_id
      AND user_id = _user_id
  )
$$;

-- Update INSERT policy for projects to ensure single submission per user per hackathon
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

CREATE POLICY "Users can create projects"
ON public.projects
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND is_gallery_public(hackathon_id) = true
  AND user_has_project_for_hackathon(auth.uid(), hackathon_id) = false
);