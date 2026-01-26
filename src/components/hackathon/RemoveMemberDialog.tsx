import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  teamId: string;
}

export function RemoveMemberDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  teamId,
}: RemoveMemberDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Fetch the member to send notification
      const { data: member } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('id', memberId)
        .single();

      if (member?.user_id) {
        await supabase.from('notifications').insert({
          user_id: member.user_id,
          type: 'team_invite',
          title: 'Removed from Team',
          message: `You have been removed from the team.`,
          metadata: { team_id: teamId, removed: true },
        });
      }
    },
    onSuccess: () => {
      toast({
        title: 'Member removed',
        description: `${memberName} has been removed from the team.`,
      });
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{memberName}</strong> from the team?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              removeMutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
