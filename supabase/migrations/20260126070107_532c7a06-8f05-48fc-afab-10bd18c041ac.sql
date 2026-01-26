-- Add gender column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender text;

-- Add team_unique_id to teams table for QR code identification
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS team_unique_id text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_unique_id ON public.teams(team_unique_id);

-- Create function to generate unique team ID when application is accepted
CREATE OR REPLACE FUNCTION public.generate_team_unique_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id text;
  exists_check boolean;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric ID
    new_id := upper(substr(md5(random()::text), 1, 8));
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM teams WHERE team_unique_id = new_id) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN new_id;
END;
$$;