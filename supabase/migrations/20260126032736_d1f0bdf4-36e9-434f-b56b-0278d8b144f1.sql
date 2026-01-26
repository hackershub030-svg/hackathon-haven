-- Create table for team invite codes
CREATE TABLE public.team_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast code lookups
CREATE INDEX idx_team_invite_codes_code ON public.team_invite_codes(code);
CREATE INDEX idx_team_invite_codes_team ON public.team_invite_codes(team_id);

-- Enable RLS
ALTER TABLE public.team_invite_codes ENABLE ROW LEVEL SECURITY;

-- Team leaders can create invite codes
CREATE POLICY "Team leaders can create invite codes"
ON public.team_invite_codes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = team_invite_codes.team_id
    AND teams.created_by = auth.uid()
  )
);

-- Team leaders can view their team's invite codes
CREATE POLICY "Team leaders can view team invite codes"
ON public.team_invite_codes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = team_invite_codes.team_id
    AND teams.created_by = auth.uid()
  )
);

-- Anyone can view active codes by code (for joining)
CREATE POLICY "Anyone can lookup active invite codes"
ON public.team_invite_codes
FOR SELECT
USING (status = 'active');

-- Team leaders can update their codes
CREATE POLICY "Team leaders can update invite codes"
ON public.team_invite_codes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = team_invite_codes.team_id
    AND teams.created_by = auth.uid()
  )
);

-- Add join_status to team_members for pending requests
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS join_status VARCHAR(20) DEFAULT 'accepted' CHECK (join_status IN ('pending', 'accepted', 'rejected'));

-- Update existing accepted members to have proper status
UPDATE public.team_members SET join_status = 'accepted' WHERE accepted = true;
UPDATE public.team_members SET join_status = 'pending' WHERE accepted = false;

-- Enable realtime for team_members to track join requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;

-- Create function to check if user is already in a team for this hackathon
CREATE OR REPLACE FUNCTION public.user_in_hackathon_team(_user_id UUID, _hackathon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = _user_id
    AND t.hackathon_id = _hackathon_id
    AND (tm.accepted = true OR tm.join_status = 'pending')
  )
$$;