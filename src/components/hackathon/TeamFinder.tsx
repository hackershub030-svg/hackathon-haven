import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Users,
  Mail,
  GraduationCap,
  MapPin,
  Loader2,
  UserPlus,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PublicProfileModal } from '@/components/profile/PublicProfileModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TeamFinderProps {
  hackathonId: string;
}

const SKILL_FILTERS = [
  'React', 'TypeScript', 'Python', 'Node.js', 'Machine Learning', 'AI',
  'Web3', 'Blockchain', 'UI/UX Design', 'Backend', 'Frontend', 'Mobile',
];

export function TeamFinder({ hackathonId }: TeamFinderProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch participants who are looking for teams (have applications but not in a team yet, or solo)
  const { data: participants, isLoading } = useQuery({
    queryKey: ['hackathon-participants-looking', hackathonId],
    queryFn: async () => {
      // Get all accepted applications for this hackathon
      const { data: applications, error: appsError } = await supabase
        .from('applications')
        .select('user_id, team_id')
        .eq('hackathon_id', hackathonId)
        .eq('status', 'accepted');

      if (appsError) throw appsError;

      // Get teams with their member counts
      const teamIds = applications?.filter(a => a.team_id).map(a => a.team_id) || [];
      
      let soloUserIds: string[] = [];
      
      if (teamIds.length > 0) {
        // Find teams where the user is the only member (looking for teammates)
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('team_id, user_id')
          .in('team_id', teamIds)
          .eq('accepted', true);

        // Group by team and find solo teams
        const teamMemberCounts = teamMembers?.reduce((acc, tm) => {
          acc[tm.team_id] = (acc[tm.team_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        // Get users in solo teams (teams with only 1 member)
        const soloTeamIds = Object.entries(teamMemberCounts)
          .filter(([_, count]) => count === 1)
          .map(([teamId]) => teamId);

        soloUserIds = teamMembers
          ?.filter(tm => soloTeamIds.includes(tm.team_id) && tm.user_id)
          .map(tm => tm.user_id!) || [];
      }

      // Also include users who applied without a team
      const noTeamUserIds = applications
        ?.filter(a => !a.team_id && a.user_id)
        .map(a => a.user_id) || [];

      const allUserIds = [...new Set([...soloUserIds, ...noTeamUserIds])];
      
      // Exclude current user
      const filteredUserIds = allUserIds.filter(id => id !== user?.id);

      if (filteredUserIds.length === 0) return [];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', filteredUserIds)
        .eq('is_public', true);

      if (profilesError) throw profilesError;

      return profiles || [];
    },
    enabled: !!hackathonId && !!user,
  });

  const filteredParticipants = participants?.filter(p => {
    const matchesSearch = !searchQuery || 
      p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.college?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.skills?.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSkill = !skillFilter || 
      p.skills?.some((s: string) => s.toLowerCase().includes(skillFilter.toLowerCase()));

    return matchesSearch && matchesSkill;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Find Teammates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with other participants who are looking for team members
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, college, or skills..."
            className="pl-10 bg-muted/50 border-border"
          />
        </div>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-muted/50 border-border">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by skill" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Skills</SelectItem>
            {SKILL_FILTERS.map((skill) => (
              <SelectItem key={skill} value={skill}>
                {skill}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchQuery || skillFilter) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchQuery('');
              setSkillFilter('');
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Participants List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredParticipants && filteredParticipants.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParticipants.map((participant, index) => (
            <motion.div
              key={participant.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => setSelectedUserId(participant.user_id)}
            >
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="w-12 h-12 border-2 border-primary/30">
                  <AvatarImage src={participant.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20">
                    {participant.full_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {participant.full_name || 'Anonymous'}
                  </h3>
                  {participant.college && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      <span className="truncate">{participant.college}</span>
                    </p>
                  )}
                </div>
              </div>

              {participant.country && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                  <MapPin className="w-3 h-3" />
                  {participant.country}
                </p>
              )}

              {participant.skills && participant.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {participant.skills.slice(0, 4).map((skill: string) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="text-xs bg-primary/20 text-primary border-0"
                    >
                      {skill}
                    </Badge>
                  ))}
                  {participant.skills.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{participant.skills.length - 4}
                    </Badge>
                  )}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full gap-2 text-primary hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedUserId(participant.user_id);
                  }}
                >
                  <Users className="w-4 h-4" />
                  View Profile
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchQuery || skillFilter
              ? 'No participants match your search criteria'
              : 'No participants looking for teammates yet'}
          </p>
        </div>
      )}

      {/* Profile Modal */}
      <PublicProfileModal
        open={!!selectedUserId}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
        userId={selectedUserId || ''}
      />
    </motion.div>
  );
}
