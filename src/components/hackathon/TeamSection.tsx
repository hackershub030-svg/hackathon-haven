import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Mail, CheckCircle2, Clock, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

interface TeamSectionProps {
  teamId: string;
  hackathon: {
    title: string;
  };
}

export function TeamSection({ teamId, hackathon }: TeamSectionProps) {
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
        .order('role', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {team?.team_name}
          </h2>
          <p className="text-muted-foreground">Your team for {hackathon.title}</p>
        </div>
        <Badge className="bg-primary/20 text-primary border border-primary/30">
          {members?.length || 0} members
        </Badge>
      </div>

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
                    <Crown className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {member.email}
                </p>
              </div>
            </div>
            <Badge
              className={
                member.accepted
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
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
          </div>
        ))}
      </div>
    </motion.div>
  );
}
