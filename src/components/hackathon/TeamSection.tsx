import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Mail, CheckCircle2, Clock, Crown, Share2, UserMinus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TeamInviteModal } from './TeamInviteModal';
import { TeamJoinRequests } from './TeamJoinRequests';
import { RemoveMemberDialog } from './RemoveMemberDialog';

interface TeamSectionProps {
  teamId: string;
  hackathon: {
    title: string;
    max_team_size?: number | null;
  };
  hackathonId: string;
}

export function TeamSection({ teamId, hackathon, hackathonId }: TeamSectionProps) {
  const { user } = useAuth();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [removeMember, setRemoveMember] = useState<{ id: string; name: string } | null>(null);

  const { data: team } = useQuery({
    queryKey: ['team', teamId],
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

  const { data: members } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profile:profiles(full_name, avatar_url, username)
        `)
        .eq('team_id', teamId)
        .neq('join_status', 'pending')
        .order('role', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const isTeamLeader = team?.created_by === user?.id;
  const maxTeamSize = hackathon.max_team_size || 4;
  const currentMemberCount = members?.length || 0;
  const canInviteMore = currentMemberCount < maxTeamSize;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 space-y-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {team?.team_name}
            </h2>
            <p className="text-muted-foreground">Your team for {hackathon.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant={canInviteMore ? 'secondary' : 'destructive'}
              className={canInviteMore 
                ? 'bg-primary/20 text-primary border border-primary/30'
                : ''
              }
            >
              {currentMemberCount} / {maxTeamSize} members
            </Badge>
            {isTeamLeader && canInviteMore && (
              <Button
                onClick={() => setInviteModalOpen(true)}
                variant="outline"
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                Invite Members
              </Button>
            )}
            {isTeamLeader && !canInviteMore && (
              <Badge variant="outline" className="text-muted-foreground">
                Team Full
              </Badge>
            )}
          </div>
        </div>

        {/* Join Requests for Team Leaders */}
        {isTeamLeader && <TeamJoinRequests teamId={teamId} hackathonId={hackathonId} />}

        <div className="space-y-4">
          {members?.map((member: any) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-primary/30">
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20">
                    {member.profile?.full_name?.[0] || member.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {member.profile?.full_name || member.email.split('@')[0]}
                    </p>
                    {member.role === 'leader' && (
                      <Crown className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {member.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    member.accepted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }
                >
                  {member.accepted ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Joined
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      Pending
                    </>
                  )}
                </Badge>
                {/* Remove button for team leader (not for themselves) */}
                {isTeamLeader && member.role !== 'leader' && member.accepted && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setRemoveMember({
                      id: member.id,
                      name: member.profile?.full_name || member.email.split('@')[0],
                    })}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Invite Modal */}
      {team && (
        <TeamInviteModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          teamId={teamId}
          hackathonId={hackathonId}
          teamName={team.team_name}
          maxTeamSize={maxTeamSize}
          currentMemberCount={currentMemberCount}
        />
      )}

      {/* Remove Member Dialog */}
      {removeMember && (
        <RemoveMemberDialog
          open={!!removeMember}
          onOpenChange={(open) => !open && setRemoveMember(null)}
          memberId={removeMember.id}
          memberName={removeMember.name}
          teamId={teamId}
        />
      )}
    </>
  );
}
