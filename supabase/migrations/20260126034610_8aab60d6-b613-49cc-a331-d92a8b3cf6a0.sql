-- Add policy allowing users to insert themselves as pending members via invite code
CREATE POLICY "Users can join teams via invite code"
ON public.team_members
FOR INSERT
WITH CHECK (
  -- User can only insert themselves
  auth.uid() = user_id
  AND
  -- They must have a valid invite code for this team
  EXISTS (
    SELECT 1 FROM public.team_invite_codes
    WHERE team_invite_codes.team_id = team_members.team_id
    AND team_invite_codes.status = 'active'
    AND (team_invite_codes.expires_at IS NULL OR team_invite_codes.expires_at > now())
  )
  AND
  -- They're not already in a team for this hackathon
  NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    JOIN public.teams target_team ON target_team.id = team_members.team_id
    WHERE tm.user_id = auth.uid()
    AND t.hackathon_id = target_team.hackathon_id
  )
);

-- Add policy allowing users to delete their own pending membership
CREATE POLICY "Users can cancel own pending requests"
ON public.team_members
FOR DELETE
USING (
  auth.uid() = user_id 
  AND join_status = 'pending'
);