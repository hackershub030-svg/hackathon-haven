import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, CheckCircle2, Crown, Loader2, Mail, LogOut, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TeamStatusCardProps {
  team: {
    id: string;
    team_name: string;
    hackathon_id: string;
    created_by: string;
  };
  isApproved: boolean;
  isPending: boolean;
  isLeader: boolean;
  hackathonTitle: string;
  joinStatus: string | null;
}

export function TeamStatusCard({ 
  team, 
  isApproved, 
  isPending, 
  isLeader, 
  hackathonTitle,
  joinStatus 
}: TeamStatusCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Fetch team members
  const { data: teamMembers, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['team-members-status', team.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', team.id)
        .eq('accepted', true);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch team leader profile for pending members
  const { data: leaderProfile } = useQuery({
    queryKey: ['team-leader-profile', team.created_by],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .eq('user_id', team.created_by)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: isPending,
  });

  // Fetch profiles for team members
  const { data: profiles } = useQuery({
    queryKey: ['team-member-profiles-status', teamMembers?.map(m => m.user_id).filter(Boolean)],
    queryFn: async () => {
      const userIds = teamMembers?.map(m => m.user_id).filter(Boolean) as string[];
      if (!userIds.length) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .in('user_id', userIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!teamMembers && teamMembers.length > 0,
  });

  // Leave team mutation
  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', team.id)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Left team',
        description: `You have left "${team.team_name}"`,
      });
      queryClient.invalidateQueries({ queryKey: ['user-team-membership'] });
      queryClient.invalidateQueries({ queryKey: ['user-team-membership-apply'] });
      queryClient.invalidateQueries({ queryKey: ['my-team-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setShowLeaveDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to leave team',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const getProfileForMember = (userId: string | null) => {
    if (!userId || !profiles) return null;
    return profiles.find(p => p.user_id === userId);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center">
            {isApproved ? (
              <CheckCircle2 className="w-7 h-7 text-primary-foreground" />
            ) : (
              <Users className="w-7 h-7 text-primary-foreground" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-heading font-bold">
              {isApproved ? "You're in!" : isPending ? 'Request Pending' : 'Team Joined'}
            </h2>
            <p className="text-muted-foreground">
              {isApproved 
                ? `You're a member of team "${team.team_name}" for ${hackathonTitle}`
                : isPending 
                  ? 'Your join request is waiting for approval from the team leader'
                  : `You've joined team "${team.team_name}"`
              }
            </p>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-border bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Users className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">{team.team_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {isLeader ? 'Team Leader' : 'Team Member'}
                </p>
              </div>
            </div>
            <Badge className={isApproved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : isPending ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-primary/20 text-primary'}>
              {isApproved ? 'Approved' : isPending ? 'Pending Approval' : joinStatus}
            </Badge>
          </div>

          {/* Team Members List */}
          {isApproved && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Team Members</h4>
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers?.map((member) => {
                    const profile = getProfileForMember(member.user_id);
                    const isTeamLeader = member.role === 'leader';
                    const displayName = profile?.full_name || member.email;
                    
                    return (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary text-sm">
                            {getInitials(profile?.full_name || null, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        {isTeamLeader && (
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <Crown className="w-3 h-3" />
                            <span>Leader</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Team Leader Contact for Pending Members */}
          {isPending && leaderProfile && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Team Leader</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={leaderProfile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {getInitials(leaderProfile.full_name, leaderProfile.email || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{leaderProfile.full_name || 'Team Leader'}</p>
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Crown className="w-3 h-3" />
                    <span>Leader</span>
                  </div>
                </div>
                {leaderProfile.email && (
                  <a 
                    href={`mailto:${leaderProfile.email}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Contact
                  </a>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                Your request is pending. Feel free to reach out to the team leader if you have any questions.
              </p>
            </div>
          )}

          {/* Leave Team Button (not for leaders) */}
          {!isLeader && (
            <div className="mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => setShowLeaveDialog(true)}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave Team
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Leave Team Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Leave Team?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{team.team_name}"? You'll need to request to join again or join another team to participate in this hackathon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveTeamMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={leaveTeamMutation.isPending}
            >
              {leaveTeamMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Leaving...
                </>
              ) : (
                'Leave Team'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
