-- Fix RLS policies on applications table - change from restrictive to permissive
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Organizers can view hackathon applications" ON public.applications;
DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;

-- Recreate as PERMISSIVE policies (either condition grants access)
CREATE POLICY "Organizers can view hackathon applications" 
ON public.applications 
FOR SELECT 
TO authenticated
USING (is_hackathon_organizer(auth.uid(), hackathon_id));

CREATE POLICY "Users can view own applications" 
ON public.applications 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Also fix the organizers update policy so they can accept/reject
DROP POLICY IF EXISTS "Organizers can update applications" ON public.applications;
CREATE POLICY "Organizers can update applications" 
ON public.applications 
FOR UPDATE 
TO authenticated
USING (is_hackathon_organizer(auth.uid(), hackathon_id));

-- Add judging rubrics table
CREATE TABLE public.judging_rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID REFERENCES public.hackathons(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    max_score INTEGER NOT NULL DEFAULT 10,
    weight NUMERIC NOT NULL DEFAULT 1.0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add project scores table
CREATE TABLE public.project_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    rubric_id UUID REFERENCES public.judging_rubrics(id) ON DELETE CASCADE NOT NULL,
    judge_id UUID NOT NULL,
    score INTEGER NOT NULL,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, rubric_id, judge_id)
);

-- Add winner column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS winner_position INTEGER DEFAULT NULL;

-- Enable RLS
ALTER TABLE public.judging_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_scores ENABLE ROW LEVEL SECURITY;

-- RLS for judging_rubrics
CREATE POLICY "Anyone can view rubrics for live hackathons" 
ON public.judging_rubrics 
FOR SELECT 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.hackathons 
    WHERE id = hackathon_id AND status = 'live'
));

CREATE POLICY "Organizers can manage rubrics" 
ON public.judging_rubrics 
FOR ALL 
TO authenticated
USING (is_hackathon_organizer(auth.uid(), hackathon_id));

-- RLS for project_scores
CREATE POLICY "Organizers can view all scores" 
ON public.project_scores 
FOR SELECT 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND is_hackathon_organizer(auth.uid(), p.hackathon_id)
));

CREATE POLICY "Judges can manage own scores" 
ON public.project_scores 
FOR ALL 
TO authenticated
USING (auth.uid() = judge_id);

-- Organizers can update projects (for setting winners)
DROP POLICY IF EXISTS "Organizers can update projects" ON public.projects;
CREATE POLICY "Organizers can update projects" 
ON public.projects 
FOR UPDATE 
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.hackathons h 
    WHERE h.id = hackathon_id AND is_hackathon_organizer(auth.uid(), h.id)
));