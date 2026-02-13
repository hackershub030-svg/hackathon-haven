
-- Create judges table
CREATE TABLE public.judges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hackathon_id UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hackathon_id, email)
);

ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage judges"
  ON public.judges FOR ALL
  USING (is_hackathon_organizer(auth.uid(), hackathon_id));

CREATE POLICY "Judges can view own record"
  ON public.judges FOR SELECT
  USING (auth.uid() = user_id);

-- Create judge_team_assignments table
CREATE TABLE public.judge_team_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  judge_id UUID NOT NULL REFERENCES public.judges(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(judge_id, team_id)
);

ALTER TABLE public.judge_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage assignments"
  ON public.judge_team_assignments FOR ALL
  USING (is_hackathon_organizer(auth.uid(), hackathon_id));

CREATE POLICY "Judges can view own assignments"
  ON public.judge_team_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.judges j
    WHERE j.id = judge_team_assignments.judge_id AND j.user_id = auth.uid()
  ));

-- Create judge_scores table (separate from project_scores to avoid conflicts)
CREATE TABLE public.judge_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  judge_id UUID NOT NULL REFERENCES public.judges(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  rubric_id UUID NOT NULL REFERENCES public.judging_rubrics(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(judge_id, team_id, rubric_id)
);

ALTER TABLE public.judge_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Judges can manage own scores"
  ON public.judge_scores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.judges j
    WHERE j.id = judge_scores.judge_id AND j.user_id = auth.uid()
  ));

CREATE POLICY "Organizers can view and edit all scores"
  ON public.judge_scores FOR ALL
  USING (is_hackathon_organizer(auth.uid(), hackathon_id));

-- Add abstract column to applications for team abstract
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS abstract TEXT;

-- Enable realtime for judge_scores
ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.judges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_team_assignments;
