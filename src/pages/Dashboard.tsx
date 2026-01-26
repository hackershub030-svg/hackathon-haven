import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Plus,
  Calendar,
  Users,
  FolderOpen,
  Bell,
  Settings,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type ApplicationStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'waitlisted';
type ParticipationType = 'application' | 'team';

interface Application {
  id: string;
  status: ApplicationStatus;
  submitted_at: string | null;
  created_at: string;
  hackathon: {
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
  };
  team: {
    id: string;
    team_name: string;
  } | null;
}

interface TeamParticipation {
  id: string;
  team_id: string;
  team_name: string;
  hackathon_id: string;
  hackathon_title: string;
  hackathon_start_date: string | null;
  hackathon_end_date: string | null;
  role: 'leader' | 'member';
  joined_at: string;
}

interface CombinedParticipation {
  id: string;
  type: ParticipationType;
  hackathon_id: string;
  hackathon_title: string;
  hackathon_start_date: string | null;
  hackathon_end_date: string | null;
  team_id: string | null;
  team_name: string | null;
  status: ApplicationStatus | 'team_member';
  role?: 'leader' | 'member';
  created_at: string;
}

interface OrganizerHackathon {
  id: string;
  title: string;
  status: 'draft' | 'live' | 'ended';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

const statusConfig = {
  draft: { label: 'Draft', icon: Clock, className: 'status-draft' },
  submitted: { label: 'Submitted', icon: Clock, className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  accepted: { label: 'Accepted', icon: CheckCircle2, className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  waitlisted: { label: 'Waitlisted', icon: Clock, className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  team_member: { label: 'Team Member', icon: UserCheck, className: 'bg-primary/20 text-primary border border-primary/30' },
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('applications');

  // Fetch applications (direct applications)
  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['my-applications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          id,
          status,
          submitted_at,
          created_at,
          hackathon:hackathons(id, title, start_date, end_date),
          team:teams(id, team_name)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Application[];
    },
    enabled: !!user,
  });

  // Fetch team memberships (team-based participation)
  const { data: teamMemberships, isLoading: teamMembershipsLoading } = useQuery({
    queryKey: ['my-team-memberships', user?.id],
    queryFn: async () => {
      // First get the user's team memberships
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('id, team_id, role, created_at, accepted, join_status')
        .eq('user_id', user!.id)
        .eq('accepted', true)
        .eq('join_status', 'accepted');

      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) return [];

      // Get team details with hackathon info
      const teamIds = memberships.map(m => m.team_id);
      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('id, team_name, hackathon_id')
        .in('id', teamIds);

      if (teamError) throw teamError;
      if (!teams) return [];

      // Get hackathon details
      const hackathonIds = teams.map(t => t.hackathon_id);
      const { data: hackathons, error: hackathonError } = await supabase
        .from('hackathons')
        .select('id, title, start_date, end_date')
        .in('id', hackathonIds);

      if (hackathonError) throw hackathonError;

      // Combine the data
      return memberships.map(membership => {
        const team = teams.find(t => t.id === membership.team_id);
        const hackathon = hackathons?.find(h => h.id === team?.hackathon_id);
        return {
          id: membership.id,
          team_id: membership.team_id,
          team_name: team?.team_name || 'Unknown Team',
          hackathon_id: team?.hackathon_id || '',
          hackathon_title: hackathon?.title || 'Unknown Hackathon',
          hackathon_start_date: hackathon?.start_date || null,
          hackathon_end_date: hackathon?.end_date || null,
          role: membership.role as 'leader' | 'member',
          joined_at: membership.created_at,
        };
      }).filter(m => m.hackathon_id) as TeamParticipation[];
    },
    enabled: !!user,
  });

  // Combine applications and team memberships, deduplicating by hackathon_id
  const combinedParticipations = useMemo(() => {
    const participations: CombinedParticipation[] = [];
    const seenHackathons = new Set<string>();

    // Add applications first
    applications?.forEach(app => {
      if (!seenHackathons.has(app.hackathon.id)) {
        seenHackathons.add(app.hackathon.id);
        participations.push({
          id: app.id,
          type: 'application',
          hackathon_id: app.hackathon.id,
          hackathon_title: app.hackathon.title,
          hackathon_start_date: app.hackathon.start_date,
          hackathon_end_date: app.hackathon.end_date,
          team_id: app.team?.id || null,
          team_name: app.team?.team_name || null,
          status: app.status,
          created_at: app.created_at,
        });
      }
    });

    // Add team memberships (if not already in applications)
    teamMemberships?.forEach(membership => {
      if (!seenHackathons.has(membership.hackathon_id)) {
        seenHackathons.add(membership.hackathon_id);
        participations.push({
          id: membership.id,
          type: 'team',
          hackathon_id: membership.hackathon_id,
          hackathon_title: membership.hackathon_title,
          hackathon_start_date: membership.hackathon_start_date,
          hackathon_end_date: membership.hackathon_end_date,
          team_id: membership.team_id,
          team_name: membership.team_name,
          status: 'team_member',
          role: membership.role,
          created_at: membership.joined_at,
        });
      }
    });

    // Sort by created_at descending
    return participations.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [applications, teamMemberships]);

  const { data: organizerHackathons, isLoading: organizerLoading } = useQuery({
    queryKey: ['organizer-hackathons', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hackathons')
        .select('id, title, status, start_date, end_date, created_at')
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrganizerHackathon[];
    },
    enabled: !!user,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Real-time subscription for team membership changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`dashboard-memberships-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-team-memberships', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const isLoading = applicationsLoading || teamMembershipsLoading;
  const totalTeams = combinedParticipations.filter(p => p.team_id).length;

  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-heading font-bold mb-2">
              Welcome back, <span className="gradient-text">{profile?.full_name || 'Hacker'}</span>
            </h1>
            <p className="text-muted-foreground">
              Manage your hackathon applications, teams, and projects
            </p>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{combinedParticipations.length}</p>
                  <p className="text-sm text-muted-foreground">Hackathons</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{totalTeams}</p>
                  <p className="text-sm text-muted-foreground">Teams</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{organizerHackathons?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Organized</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{notifications?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Notifications</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="applications">My Hackathons</TabsTrigger>
                  <TabsTrigger value="organized">Organized</TabsTrigger>
                </TabsList>
                <Link to="/create-hackathon">
                  <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Hackathon
                  </Button>
                </Link>
              </div>

              <TabsContent value="applications">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : combinedParticipations.length > 0 ? (
                  <div className="space-y-4">
                    {combinedParticipations.map((participation) => {
                      const status = statusConfig[participation.status];
                      const StatusIcon = status.icon;
                      return (
                        <Link key={participation.id} to={`/hackathon/${participation.hackathon_id}`}>
                          <div className="glass-card p-6 hover:scale-[1.01] transition-transform">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-heading font-semibold">
                                    {participation.hackathon_title}
                                  </h3>
                                  <Badge className={status.className}>
                                    <StatusIcon className="w-3 h-3 mr-1" />
                                    {status.label}
                                  </Badge>
                                  {participation.role === 'leader' && (
                                    <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                                      Team Leader
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  {participation.team_name && (
                                    <span className="flex items-center gap-1">
                                      <Users className="w-4 h-4" />
                                      {participation.team_name}
                                    </span>
                                  )}
                                  {participation.hackathon_start_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      {format(new Date(participation.hackathon_start_date), 'MMM d, yyyy')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                View Details
                              </Button>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-card p-12 text-center">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-heading font-semibold mb-2">No hackathons yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Start by exploring and applying to hackathons, or join a team
                    </p>
                    <Link to="/hackathons">
                      <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
                        Browse Hackathons
                      </Button>
                    </Link>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="organized">
                {organizerLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : organizerHackathons && organizerHackathons.length > 0 ? (
                  <div className="space-y-4">
                    {organizerHackathons.map((hackathon) => (
                      <Link key={hackathon.id} to={`/organizer/${hackathon.id}`}>
                        <div className="glass-card p-6 hover:scale-[1.01] transition-transform">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-heading font-semibold">
                                  {hackathon.title}
                                </h3>
                                <Badge
                                  className={
                                    hackathon.status === 'live'
                                      ? 'status-live'
                                      : hackathon.status === 'draft'
                                      ? 'status-draft'
                                      : 'status-ended'
                                  }
                                >
                                  {hackathon.status.charAt(0).toUpperCase() + hackathon.status.slice(1)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {hackathon.start_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {format(new Date(hackathon.start_date), 'MMM d, yyyy')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4 mr-2" />
                              Manage
                            </Button>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="glass-card p-12 text-center">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-heading font-semibold mb-2">
                      No hackathons organized yet
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Create your first hackathon and bring the community together
                    </p>
                    <Link to="/create-hackathon">
                      <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Hackathon
                      </Button>
                    </Link>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
