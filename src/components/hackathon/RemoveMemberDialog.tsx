import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserMinus } from 'lucide-react';

interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  memberEmail: string;
  teamId: string;
  hackathonId: string;
}

export function RemoveMemberDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  memberEmail,
  teamId,
  hackathonId,
}: RemoveMemberDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const removeMutation = useMutation({
    mutationFn: async () => {
      // Fetch member and team info before deletion
      const { data: member } = await supabase
        .from('team_members')
        .select('user_id, email')
        .eq('id', memberId)
        .single();

      const { data: team } = await supabase
        .from('teams')
        .select('team_name')
        .eq('id', teamId)
        .single();

      const { data: hackathon } = await supabase
        .from('hackathons')
        .select('title')
        .eq('id', hackathonId)
        .single();

      // Delete the member
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Create in-app notification
      if (member?.user_id) {
        await supabase.from('notifications').insert({
          user_id: member.user_id,
          type: 'team_invite',
          title: 'Removed from Team',
          message: reason 
            ? `You have been removed from the team. Reason: ${reason}`
            : `You have been removed from the team.`,
          metadata: { team_id: teamId, removed: true, reason },
        });
      }

      // Send email notification
      try {
        await supabase.functions.invoke('send-team-request-notification', {
          body: {
            recipientEmail: member?.email || memberEmail,
            recipientName: memberName,
            teamName: team?.team_name || 'Unknown Team',
            hackathonName: hackathon?.title || 'Unknown Hackathon',
            removed: true,
            removalReason: reason || undefined,
          },
        });
      } catch (emailError) {
        console.error('Failed to send removal email:', emailError);
        // Don't fail if email fails
      }
    },
    onSuccess: () => {
      toast({
        title: 'Member removed',
        description: `${memberName} has been removed from the team.`,
      });
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-all-members', teamId] });
      setReason('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove member',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-destructive" />
            Remove Team Member
          </DialogTitle>
          <DialogDescription>
            Remove <strong>{memberName}</strong> from the team. They will be notified via email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for the removal (will be included in the notification)..."
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              This message will be included in the email sent to the member.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
          >
            {removeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              'Remove Member'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
