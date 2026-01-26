-- Add INSERT policy for notifications table to allow system notifications
-- This allows team leaders and system operations to create notifications for other users
CREATE POLICY "Allow system and team leaders to create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Note: The application code should validate who can send notifications to whom