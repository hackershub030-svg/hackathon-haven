import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  History,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  UserMinus,
  Loader2,
  Activity,
  Crown,
} from 'lucide-react';

interface TeamDashboardProps {
  teamId: string;
  hackathonId: string;
}

interface TeamActivity {
  id: string;
  type: 'join_request' | 'approved' | 'rejected' | 'removed' | 'left';
  memberName: string;
  memberEmail: string;
  timestamp: string;
  details?: string;
}

export function TeamDashboard({ teamId, hackathonId }: TeamDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch team info
  const { data: team, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['team-dashboard', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch all members (including pending, rejected)
  const { data: allMembers, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['team-all-members', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching team members:', error);
        throw error;
      }
      
      // Fetch profiles separately for members with user_id
      const userIds = data?.filter(m => m.user_id).map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      
      // Merge profile data with members
      const membersWithProfiles = data?.map(member => ({
        ...member,
        profile: profiles?.find(p => p.user_id === member.user_id) || null
      }));
      
      console.log('Team members with profiles:', membersWithProfiles);
      return membersWithProfiles;
    },
  });

  // Real-time subscription for team member changes
  useEffect(() => {
    const channel = supabase
      .channel(`team-members-realtime-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-all-members', teamId] });
          queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient]);

  // Simulate activity log from team members data
  const activities: TeamActivity[] = allMembers?.map((member: any) => {
    let type: TeamActivity['type'] = 'join_request';
    if (member.accepted && member.join_status === 'accepted') {
      type = 'approved';
    } else if (member.join_status === 'rejected') {
      type = 'rejected';
    } else if (member.join_status === 'pending') {
      type = 'join_request';
    } else if (member.join_status === 'invited') {
      type = 'join_request';
    }

    return {
      id: member.id,
      type,
      memberName: member.profile?.full_name || member.email.split('@')[0],
      memberEmail: member.email,
      timestamp: member.created_at,
      details: member.join_status,
    };
  }) || [];

  // Stats
  const activeMembers = allMembers?.filter((m: any) => m.accepted) || [];
  const pendingRequests = allMembers?.filter((m: any) => m.join_status === 'pending') || [];
  const invitedMembers = allMembers?.filter((m: any) => m.join_status === 'invited') || [];

  const isLoading = isLoadingTeam || isLoadingMembers;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const getActivityIcon = (type: TeamActivity['type']) => {
    switch (type) {
      case 'join_request':
        return <UserPlus className="w-4 h-4 text-primary" />;
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'removed':
        return <UserMinus className="w-4 h-4 text-amber-500" />;
      case 'left':
        return <UserMinus className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Activity className="w-4 h-4 text-primary" />;
    }
  };

  const getActivityLabel = (type: TeamActivity['type']) => {
    switch (type) {
      case 'join_request':
        return 'Requested to join';
      case 'approved':
        return 'Joined the team';
      case 'rejected':
        return 'Request declined';
      case 'removed':
        return 'Was removed';
      case 'left':
        return 'Left the team';
      default:
        return 'Activity';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 space-y-6"
    >
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-heading font-semibold">Team Dashboard</h3>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-muted/30 text-center">
          <div className="text-2xl font-bold text-primary">{activeMembers.length}</div>
          <div className="text-sm text-muted-foreground">Active Members</div>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 text-center">
          <div className="text-2xl font-bold text-amber-400">{pendingRequests.length}</div>
          <div className="text-sm text-muted-foreground">Pending Requests</div>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 text-center">
          <div className="text-2xl font-bold text-blue-400">{invitedMembers.length}</div>
          <div className="text-sm text-muted-foreground">Invited</div>
        </div>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="w-full bg-muted/50">
          <TabsTrigger value="members" className="flex-1">
            <Users className="w-4 h-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">
            <History className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4 space-y-3">
          {allMembers?.map((member: any) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-xs">
                    {(member.profile?.full_name?.[0] || member.email[0]).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">
                      {member.profile?.full_name || member.email.split('@')[0]}
                    </span>
                    {member.role === 'leader' && (
                      <Crown className="w-3 h-3 text-amber-400" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{member.email}</span>
                </div>
              </div>
              <Badge
                variant={
                  member.accepted
                    ? 'default'
                    : member.join_status === 'pending'
                    ? 'secondary'
                    : 'outline'
                }
                className={
                  member.accepted
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : member.join_status === 'pending'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : ''
                }
              >
                {member.accepted
                  ? 'Active'
                  : member.join_status === 'pending'
                  ? 'Pending'
                  : member.join_status === 'invited'
                  ? 'Invited'
                  : member.join_status}
              </Badge>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity yet
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/20"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <div className="text-sm">
                    <span className="font-medium">{activity.memberName}</span>{' '}
                    <span className="text-muted-foreground">{getActivityLabel(activity.type)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
