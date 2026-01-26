import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Check,
  X,
  Loader2,
  Clock,
  UserPlus,
} from 'lucide-react';

interface TeamJoinRequestsProps {
  teamId: string;
  hackathonId: string;
}

interface ConfirmDialogState {
  open: boolean;
  memberId: string;
  memberEmail: string;
  memberName: string;
  approved: boolean;
}

export function TeamJoinRequests({ teamId, hackathonId }: TeamJoinRequestsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    memberId: '',
    memberEmail: '',
    memberName: '',
    approved: false,
  });

  // Fetch pending requests - without profile join
  const { data: pendingRequestsRaw, isLoading } = useQuery({
    queryKey: ['pending-join-requests', teamId],
    queryFn: async () => {
      console.log('Fetching pending requests for team:', teamId);
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('join_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending requests:', error);
        throw error;
      }
      console.log('Pending requests found:', data);
      return data;
    },
    enabled: !!teamId,
  });

  // Fetch profiles separately for pending members
  const { data: profiles } = useQuery({
    queryKey: ['pending-member-profiles', pendingRequestsRaw?.map(m => m.user_id).filter(Boolean)],
    queryFn: async () => {
      const userIds = pendingRequestsRaw?.map(m => m.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .in('user_id', userIds);
      
      if (error) {
        console.error('Error fetching profiles:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!pendingRequestsRaw && pendingRequestsRaw.length > 0,
  });

  // Merge pending requests with profiles
  const pendingRequests = useMemo(() => {
    if (!pendingRequestsRaw) return [];
    
    return pendingRequestsRaw.map(request => {
      const profile = profiles?.find(p => p.user_id === request.user_id);
      return {
        ...request,
        profile: profile || null,
      };
    });
  }, [pendingRequestsRaw, profiles]);

  // Subscribe to real-time updates for new requests
  useEffect(() => {
    const channel = supabase
      .channel(`team-requests-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['pending-join-requests', teamId] });
          queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
          
          if (payload.eventType === 'INSERT' && payload.new.join_status === 'pending') {
            toast({
              title: 'New join request!',
              description: 'Someone wants to join your team.',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient, toast]);

  // Approve/reject mutation
  const respondMutation = useMutation({
    mutationFn: async ({ memberId, approved, memberEmail, memberName }: { 
      memberId: string; 
      approved: boolean;
      memberEmail: string;
      memberName: string;
    }) => {
      const { data: member, error: fetchError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('id', memberId)
        .single();

      if (fetchError) throw fetchError;

      // Get team and hackathon info for email
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

      if (approved) {
        // Update member status to accepted
        const { error } = await supabase
          .from('team_members')
          .update({ 
            accepted: true, 
            join_status: 'accepted' 
          })
          .eq('id', memberId);

        if (error) throw error;

        // Notify the user
        if (member?.user_id) {
          await supabase.from('notifications').insert({
            user_id: member.user_id,
            type: 'team_invite',
            title: 'Request Approved! 🎉',
            message: `Your request to join ${team?.team_name || 'the team'} has been approved!`,
            metadata: { team_id: teamId, hackathon_id: hackathonId, approved: true },
          });
        }
      } else {
        // Remove the member request
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', memberId);

        if (error) throw error;

        // Notify the user
        if (member?.user_id) {
          await supabase.from('notifications').insert({
            user_id: member.user_id,
            type: 'team_invite',
            title: 'Request Declined',
            message: `Your request to join ${team?.team_name || 'the team'} has been declined.`,
            metadata: { team_id: teamId, hackathon_id: hackathonId, approved: false },
          });
        }
      }

      // Send email notification
      try {
        await supabase.functions.invoke('send-team-request-notification', {
          body: {
            recipientEmail: memberEmail,
            recipientName: memberName,
            teamName: team?.team_name || 'Unknown Team',
            hackathonName: hackathon?.title || 'Unknown Hackathon',
            approved,
          },
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the whole operation if email fails
      }

      return { approved };
    },
    onSuccess: ({ approved }) => {
      toast({
        title: approved ? 'Request approved!' : 'Request declined',
        description: approved
          ? 'The member has been added to your team.'
          : 'The request has been removed.',
      });
      queryClient.invalidateQueries({ queryKey: ['pending-join-requests', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-all-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-dashboard', teamId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Action failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleConfirmAction = () => {
    respondMutation.mutate({
      memberId: confirmDialog.memberId,
      approved: confirmDialog.approved,
      memberEmail: confirmDialog.memberEmail,
      memberName: confirmDialog.memberName,
    });
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const openConfirmDialog = (memberId: string, memberEmail: string, memberName: string, approved: boolean) => {
    setConfirmDialog({
      open: true,
      memberId,
      memberEmail,
      memberName,
      approved,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!pendingRequests || pendingRequests.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Pending Join Requests</h3>
          <Badge variant="secondary">{pendingRequests.length}</Badge>
        </div>

        <AnimatePresence>
          {pendingRequests.map((request: any) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-amber-500/30"
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-amber-500/30">
                  <AvatarImage src={request.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-amber-500/20">
                    {(request.profile?.full_name?.[0] || request.email[0]).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {request.profile?.full_name || request.email.split('@')[0]}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending approval
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => openConfirmDialog(
                    request.id,
                    request.email,
                    request.profile?.full_name || request.email.split('@')[0],
                    true
                  )}
                  disabled={respondMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openConfirmDialog(
                    request.id,
                    request.email,
                    request.profile?.full_name || request.email.split('@')[0],
                    false
                  )}
                  disabled={respondMutation.isPending}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="bg-background border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.approved ? 'Approve Request' : 'Reject Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.approved
                ? `Are you sure you want to approve ${confirmDialog.memberName}'s request to join your team? They will become a member immediately.`
                : `Are you sure you want to reject ${confirmDialog.memberName}'s request? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmDialog.approved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-destructive hover:bg-destructive/90'}
            >
              {respondMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {confirmDialog.approved ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
