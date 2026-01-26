import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Crown, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TransferLeadershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  hackathonId: string;
  currentLeaderId: string;
}

export function TransferLeadershipDialog({
  open,
  onOpenChange,
  teamId,
  hackathonId,
  currentLeaderId,
}: TransferLeadershipDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Fetch accepted team members (excluding current leader)
  const { data: members, isLoading } = useQuery({
    queryKey: ['transfer-leadership-members', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('accepted', true)
        .neq('role', 'leader')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles
      const userIds = data?.filter(m => m.user_id).map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      return data?.map(member => ({
        ...member,
        profile: profiles?.find(p => p.user_id === member.user_id) || null
      }));
    },
    enabled: open,
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMemberId) throw new Error('No member selected');

      const selectedMember = members?.find(m => m.id === selectedMemberId);
      if (!selectedMember) throw new Error('Member not found');

      // Update current leader to member
      const { error: demoteError } = await supabase
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', teamId)
        .eq('role', 'leader');

      if (demoteError) throw demoteError;

      // Update selected member to leader
      const { error: promoteError } = await supabase
        .from('team_members')
        .update({ role: 'leader' })
        .eq('id', selectedMemberId);

      if (promoteError) throw promoteError;

      // Update team created_by
      const { error: teamError } = await supabase
        .from('teams')
        .update({ created_by: selectedMember.user_id })
        .eq('id', teamId);

      if (teamError) throw teamError;

      // Notify the new leader
      if (selectedMember.user_id) {
        await supabase.from('notifications').insert({
          user_id: selectedMember.user_id,
          type: 'team_invite',
          title: 'You are now Team Leader! 👑',
          message: 'Leadership has been transferred to you.',
          metadata: { team_id: teamId, hackathon_id: hackathonId },
        });
      }

      return { newLeader: selectedMember };
    },
    onSuccess: ({ newLeader }) => {
      toast({
        title: 'Leadership transferred',
        description: `${newLeader.profile?.full_name || newLeader.email} is now the team leader.`,
      });
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-all-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Transfer failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            Transfer Team Leadership
          </DialogTitle>
          <DialogDescription>
            Select a team member to become the new leader. You will become a regular member.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <AlertDescription className="text-sm">
            This action cannot be undone. Only the new leader can transfer leadership back.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : members && members.length > 0 ? (
          <RadioGroup value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {members.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <RadioGroupItem value={member.id} id={member.id} />
                  <Label
                    htmlFor={member.id}
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/20 text-xs">
                        {(member.profile?.full_name?.[0] || member.email[0]).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">
                        {member.profile?.full_name || member.email.split('@')[0]}
                      </div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No eligible members to transfer leadership to. Members must have accepted their invitation.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={!selectedMemberId || transferMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-2" />
                Transfer Leadership
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}