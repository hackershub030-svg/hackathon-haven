import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  Clock,
  Wifi,
  Building,
  Sparkles,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ApplicationForm } from '@/components/hackathon/ApplicationForm';
import { TeamSection } from '@/components/hackathon/TeamSection';
import { TeamChat } from '@/components/hackathon/TeamChat';

const modeIcons = {
  online: Wifi,
  offline: Building,
  hybrid: Sparkles,
};

const modeLabels = {
  online: 'Online',
  offline: 'In-Person',
  hybrid: 'Hybrid',
};

export default function HackathonDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: hackathon, isLoading } = useQuery({
    queryKey: ['hackathon', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hackathons')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: prizes } = useQuery({
    queryKey: ['hackathon-prizes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prizes')
        .select('*')
        .eq('hackathon_id', id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: userApplication } = useQuery({
    queryKey: ['user-application', id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('hackathon_id', id)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  const { data: userTeamMembership } = useQuery({
    queryKey: ['user-team-membership', id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          team:teams!inner(*, hackathon_id)
        `)
        .eq('user_id', user!.id)
        .eq('team.hackathon_id', id)
        .eq('accepted', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!hackathon) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold mb-2">Hackathon not found</h1>
            <p className="text-muted-foreground mb-4">This hackathon doesn't exist or has been removed.</p>
            <Link to="/hackathons">
              <Button>Browse Hackathons</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const ModeIcon = modeIcons[hackathon.mode as keyof typeof modeIcons];
  const isDeadlinePassed = hackathon.application_deadline && new Date(hackathon.application_deadline) < new Date();
  const hasApplied = !!userApplication;
  const teamId = userApplication?.team?.id || userTeamMembership?.team?.id;

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Hero Banner */}
        <section className="relative h-64 md:h-80 overflow-hidden">
          {hackathon.banner_url ? (
            <img
              src={hackathon.banner_url}
              alt={hackathon.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-hero" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="container mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <Badge
                  className={
                    hackathon.status === 'live'
                      ? 'status-live'
                      : hackathon.status === 'draft'
                      ? 'status-draft'
                      : 'status-ended'
                  }
                >
                  {hackathon.status === 'live' ? 'Live' : hackathon.status === 'draft' ? 'Coming Soon' : 'Ended'}
                </Badge>
                <Badge
                  className={
                    hackathon.mode === 'online'
                      ? 'mode-online'
                      : hackathon.mode === 'offline'
                      ? 'mode-offline'
                      : 'mode-hybrid'
                  }
                >
                  <ModeIcon className="w-3 h-3 mr-1" />
                  {modeLabels[hackathon.mode as keyof typeof modeLabels]}
                </Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-heading font-bold mb-2">{hackathon.title}</h1>
              {hackathon.tagline && (
                <p className="text-xl text-muted-foreground">{hackathon.tagline}</p>
              )}
            </div>
          </div>
        </section>

        {/* Quick Info Bar */}
        <section className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-16 z-30">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-center justify-between py-4 gap-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                {hackathon.start_date && (
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(new Date(hackathon.start_date), 'MMM d')}
                    {hackathon.end_date && ` - ${format(new Date(hackathon.end_date), 'MMM d, yyyy')}`}
                  </span>
                )}
                {hackathon.location && hackathon.mode !== 'online' && (
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {hackathon.location}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Team size: {hackathon.min_team_size}-{hackathon.max_team_size}
                </span>
                {hackathon.application_deadline && (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Apply by {format(new Date(hackathon.application_deadline), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
              
              {user ? (
                hasApplied ? (
                  <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
                    Applied - {userApplication.status}
                  </Badge>
                ) : isDeadlinePassed ? (
                  <Badge variant="secondary">Applications Closed</Badge>
                ) : (
                  <Button
                    onClick={() => setActiveTab('apply')}
                    className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
                  >
                    Apply Now
                  </Button>
                )
              ) : (
                <Link to="/auth">
                  <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
                    Sign in to Apply
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50 mb-8">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="prizes">Prizes</TabsTrigger>
                {user && !hasApplied && !isDeadlinePassed && (
                  <TabsTrigger value="apply">Apply</TabsTrigger>
                )}
                {user && hasApplied && (
                  <TabsTrigger value="team">My Team</TabsTrigger>
                )}
                {teamId && (
                  <TabsTrigger value="chat">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Team Chat
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <TabsContent value="overview" className="mt-0">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-8"
                    >
                      <h2 className="text-2xl font-heading font-bold mb-4">About this Hackathon</h2>
                      {hackathon.description ? (
                        <div className="prose prose-invert max-w-none">
                          <p className="text-muted-foreground whitespace-pre-wrap">{hackathon.description}</p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No description provided.</p>
                      )}

                      {hackathon.rules && (
                        <>
                          <h3 className="text-xl font-heading font-semibold mt-8 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Rules & Guidelines
                          </h3>
                          <p className="text-muted-foreground whitespace-pre-wrap">{hackathon.rules}</p>
                        </>
                      )}
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="prizes" className="mt-0">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-8"
                    >
                      <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-primary" />
                        Prize Pool
                      </h2>
                      
                      {prizes && prizes.length > 0 ? (
                        <div className="space-y-4">
                          {prizes.map((prize, index) => (
                            <div
                              key={prize.id}
                              className={`p-6 rounded-xl border ${
                                index === 0
                                  ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30'
                                  : index === 1
                                  ? 'bg-gradient-to-r from-gray-400/10 to-gray-300/10 border-gray-400/30'
                                  : index === 2
                                  ? 'bg-gradient-to-r from-amber-700/10 to-amber-600/10 border-amber-700/30'
                                  : 'bg-muted/30 border-border'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-heading font-bold text-lg ${
                                    index === 0
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : index === 1
                                      ? 'bg-gray-400/20 text-gray-300'
                                      : index === 2
                                      ? 'bg-amber-700/20 text-amber-500'
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    #{prize.position}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold">{prize.title}</h3>
                                    {prize.description && (
                                      <p className="text-sm text-muted-foreground">{prize.description}</p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-2xl font-heading font-bold gradient-text">
                                  ${prize.amount?.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                          
                          <div className="mt-6 p-6 rounded-xl bg-gradient-primary/10 border border-primary/30">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-semibold">Total Prize Pool</span>
                              <span className="text-3xl font-heading font-bold gradient-text">
                                ${prizes.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No prizes announced yet.</p>
                      )}
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="apply" className="mt-0">
                    <ApplicationForm hackathonId={id!} hackathon={hackathon} />
                  </TabsContent>

                  <TabsContent value="team" className="mt-0">
                    {userApplication?.team && (
                      <TeamSection teamId={userApplication.team.id} hackathon={hackathon} />
                    )}
                  </TabsContent>

                  <TabsContent value="chat" className="mt-0">
                    {teamId && <TeamChat teamId={teamId} />}
                  </TabsContent>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Quick Stats */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-6"
                  >
                    <h3 className="font-heading font-semibold mb-4">Quick Info</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Mode</span>
                        <Badge className={
                          hackathon.mode === 'online'
                            ? 'mode-online'
                            : hackathon.mode === 'offline'
                            ? 'mode-offline'
                            : 'mode-hybrid'
                        }>
                          {modeLabels[hackathon.mode as keyof typeof modeLabels]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Team Size</span>
                        <span>{hackathon.min_team_size} - {hackathon.max_team_size} members</span>
                      </div>
                      {hackathon.start_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span>
                            {hackathon.end_date
                              ? `${Math.ceil((new Date(hackathon.end_date).getTime() - new Date(hackathon.start_date).getTime()) / (1000 * 60 * 60 * 24))} days`
                              : 'TBD'}
                          </span>
                        </div>
                      )}
                      {prizes && prizes.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Total Prizes</span>
                          <span className="font-semibold text-primary">
                            ${prizes.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Important Dates */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-6"
                  >
                    <h3 className="font-heading font-semibold mb-4">Important Dates</h3>
                    <div className="space-y-3">
                      {hackathon.application_deadline && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Application Deadline</p>
                            <p className="font-medium">{format(new Date(hackathon.application_deadline), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                      )}
                      {hackathon.start_date && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Hackathon Starts</p>
                            <p className="font-medium">{format(new Date(hackathon.start_date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                      )}
                      {hackathon.end_date && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-secondary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Hackathon Ends</p>
                            <p className="font-medium">{format(new Date(hackathon.end_date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            </Tabs>
          </div>
        </section>
      </div>
    </Layout>
  );
}
