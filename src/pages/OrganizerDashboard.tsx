import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Users,
  FileText,
  Trophy,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Loader2,
  Send,
  Play,
  Pause,
  Mail,
  Star,
  Image,
  Presentation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JudgingTab } from '@/components/organizer/JudgingTab';
import { PresentationViewModal } from '@/components/hackathon/PresentationViewModal';
import { ApplicationDetailModal } from '@/components/organizer/ApplicationDetailModal';

type ApplicationStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'waitlisted';
type HackathonStatus = 'draft' | 'live' | 'ended';

const statusConfig: Record<ApplicationStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  draft: { label: 'Draft', icon: Clock, className: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', icon: Clock, className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  accepted: { label: 'Accepted', icon: CheckCircle2, className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  waitlisted: { label: 'Waitlisted', icon: Clock, className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
};

export default function OrganizerDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('applications');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPresentation, setSelectedPresentation] = useState<{url: string; teamName: string} | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const { data: hackathon, isLoading: hackathonLoading } = useQuery({
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

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['hackathon-applications', id],
    queryFn: async () => {
      // First fetch applications
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          *,
          team:teams(id, team_name)
        `)
        .eq('hackathon_id', id)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;
      if (!appsData || appsData.length === 0) return [];

      // Then fetch profiles for the user_ids
      const userIds = appsData.map(app => app.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', userIds);

      // Merge profiles into applications
      return appsData.map(app => ({
        ...app,
        profile: profilesData?.find(p => p.user_id === app.user_id) || null
      }));
    },
    enabled: !!id,
  });

  // Real-time subscription for new applications
  useEffect(() => {
    if (!id) return;

    const channel: RealtimeChannel = supabase
      .channel(`applications-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'applications',
          filter: `hackathon_id=eq.${id}`,
        },
        () => {
          // Invalidate queries to refresh the data
          queryClient.invalidateQueries({ queryKey: ['hackathon-applications', id] });
          queryClient.invalidateQueries({ queryKey: ['hackathon-stats', id] });
          toast({
            title: 'New Application!',
            description: 'A new team has applied to your hackathon.',
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `hackathon_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['hackathon-applications', id] });
          queryClient.invalidateQueries({ queryKey: ['hackathon-stats', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient, toast]);

  const { data: projects } = useQuery({
    queryKey: ['hackathon-projects', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          team:teams(id, team_name)
        `)
        .eq('hackathon_id', id)
        .eq('submitted', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['hackathon-stats', id],
    queryFn: async () => {
      const [appsResult, teamsResult, projectsResult] = await Promise.all([
        supabase.from('applications').select('status', { count: 'exact' }).eq('hackathon_id', id),
        supabase.from('teams').select('id', { count: 'exact' }).eq('hackathon_id', id),
        supabase.from('projects').select('id', { count: 'exact' }).eq('hackathon_id', id).eq('submitted', true),
      ]);

      return {
        totalApplications: appsResult.count || 0,
        totalTeams: teamsResult.count || 0,
        totalProjects: projectsResult.count || 0,
        acceptedApplications: applications?.filter((a: any) => a.status === 'accepted').length || 0,
      };
    },
    enabled: !!id && !!applications,
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: ApplicationStatus }) => {
      const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', appId);

      if (error) throw error;

      // Send notification email for accept/reject/waitlist
      if ((status === 'accepted' || status === 'rejected' || status === 'waitlisted') && hackathon) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          await supabase.functions.invoke('send-application-notification', {
            body: {
              applicationId: appId,
              status,
              hackathonTitle: hackathon.title,
            },
            headers: {
              Authorization: `Bearer ${sessionData.session?.access_token}`,
            },
          });
        } catch (notifyError) {
          console.error('Failed to send notification:', notifyError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-applications'] });
      toast({ title: 'Application updated', description: 'The application status has been changed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  const updateHackathonStatusMutation = useMutation({
    mutationFn: async (status: HackathonStatus) => {
      const { error } = await supabase
        .from('hackathons')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['hackathon'] });
      toast({
        title: status === 'live' ? 'Hackathon Published!' : 'Status Updated',
        description: status === 'live'
          ? 'Your hackathon is now live and accepting applications.'
          : `Hackathon status changed to ${status}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  const toggleGalleryMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      const { error } = await supabase
        .from('hackathons')
        .update({ is_gallery_public: isPublic })
        .eq('id', id);

      if (error) throw error;

      // Send email notifications when gallery is enabled
      if (isPublic && hackathon) {
        try {
          const { data: session } = await supabase.auth.getSession();
          await supabase.functions.invoke('notify-gallery-open', {
            body: {
              hackathonId: id,
              hackathonTitle: hackathon.title,
            },
            headers: {
              Authorization: `Bearer ${session.session?.access_token}`,
            },
          });
        } catch (notifyError) {
          console.error('Failed to send notifications:', notifyError);
        }
      }
    },
    onSuccess: (_, isPublic) => {
      queryClient.invalidateQueries({ queryKey: ['hackathon'] });
      toast({
        title: isPublic ? 'Gallery Enabled' : 'Gallery Disabled',
        description: isPublic
          ? 'Participants have been notified and can now submit projects.'
          : 'The gallery is now hidden from participants.',
      });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  const filteredApplications = applications?.filter((app: any) =>
    statusFilter === 'all' || app.status === statusFilter
  );

  if (hackathonLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!hackathon || hackathon.created_by !== user?.id) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-4">You don't have permission to manage this hackathon.</p>
            <Link to="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link to="/dashboard">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-heading font-bold">{hackathon.title}</h1>
                  <Badge
                    className={
                      hackathon.status === 'live'
                        ? 'status-live'
                        : hackathon.status === 'draft'
                        ? 'status-draft'
                        : 'status-ended'
                    }
                  >
                    {hackathon.status === 'live' ? 'Live' : hackathon.status === 'draft' ? 'Draft' : 'Ended'}
                  </Badge>
                </div>
                <p className="text-muted-foreground">Organizer Dashboard</p>
              </div>

              <div className="flex items-center gap-2">
                {hackathon.status === 'draft' && (
                  <Button
                    onClick={() => updateHackathonStatusMutation.mutate('live')}
                    disabled={updateHackathonStatusMutation.isPending}
                    className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
                  >
                    {updateHackathonStatusMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Publish Hackathon
                  </Button>
                )}
                {hackathon.status === 'live' && (
                  <Button
                    onClick={() => updateHackathonStatusMutation.mutate('ended')}
                    disabled={updateHackathonStatusMutation.isPending}
                    variant="outline"
                  >
                    {updateHackathonStatusMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Pause className="w-4 h-4 mr-2" />
                    )}
                    End Hackathon
                  </Button>
                )}
                <Link to={`/create-hackathon/${id}`}>
                  <Button variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{stats?.totalApplications || 0}</p>
                  <p className="text-sm text-muted-foreground">Applications</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{stats?.acceptedApplications || 0}</p>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{stats?.totalTeams || 0}</p>
                  <p className="text-sm text-muted-foreground">Teams</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold">{stats?.totalProjects || 0}</p>
                  <p className="text-sm text-muted-foreground">Submissions</p>
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
              <TabsList className="bg-muted/50 mb-6">
                <TabsTrigger value="applications">
                  <FileText className="w-4 h-4 mr-2" />
                  Applications
                </TabsTrigger>
                <TabsTrigger value="submissions">
                  <Trophy className="w-4 h-4 mr-2" />
                  Submissions
                </TabsTrigger>
                <TabsTrigger value="judging">
                  <Star className="w-4 h-4 mr-2" />
                  Judging
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="applications">
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-heading font-semibold">Manage Applications</h2>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px] bg-muted/50 border-border">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="waitlisted">Waitlisted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {applicationsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : filteredApplications && filteredApplications.length > 0 ? (
                    <div className="space-y-4">
                      {filteredApplications.map((app: any) => {
                        const status = statusConfig[app.status as ApplicationStatus];
                        const StatusIcon = status.icon;

                        return (
                          <div
                            key={app.id}
                            className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedApplication(app)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">
                                      {app.team?.team_name || 'Solo Application'}
                                    </h3>
                                    <Badge className={status.className}>
                                      <StatusIcon className="w-3 h-3 mr-1" />
                                      {status.label}
                                    </Badge>
                                    {app.application_data?.domain && (
                                      <Badge variant="outline" className="text-xs">
                                        {app.application_data.domain}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <Mail className="w-3 h-3" />
                                    {app.profile?.email || 'No email'}
                                    <span className="mx-2">•</span>
                                    Applied {format(new Date(app.created_at), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {app.status !== 'accepted' && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      updateApplicationMutation.mutate({ appId: app.id, status: 'accepted' })
                                    }
                                    disabled={updateApplicationMutation.isPending}
                                    className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Accept
                                  </Button>
                                )}
                                {app.status !== 'waitlisted' && app.status !== 'accepted' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateApplicationMutation.mutate({ appId: app.id, status: 'waitlisted' })
                                    }
                                    disabled={updateApplicationMutation.isPending}
                                    className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
                                  >
                                    <Clock className="w-4 h-4 mr-1" />
                                    Waitlist
                                  </Button>
                                )}
                                {app.status !== 'rejected' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateApplicationMutation.mutate({ appId: app.id, status: 'rejected' })
                                    }
                                    disabled={updateApplicationMutation.isPending}
                                    className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Reject
                                  </Button>
                                )}
                              </div>
                            </div>

                            {(app.application_data || app.presentation_url) && (
                              <div className="mt-4 pt-4 border-t border-border">
                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                  {app.application_data?.project_idea && (
                                    <div>
                                      <p className="font-medium text-muted-foreground mb-1">Project Idea</p>
                                      <p>{app.application_data.project_idea}</p>
                                    </div>
                                  )}
                                  {app.application_data?.why_join && (
                                    <div>
                                      <p className="font-medium text-muted-foreground mb-1">Why Join</p>
                                      <p>{app.application_data.why_join}</p>
                                    </div>
                                  )}
                                </div>
                                {app.presentation_url && (
                                  <div className="mt-4">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedPresentation({
                                        url: app.presentation_url,
                                        teamName: app.team?.team_name || 'Team'
                                      })}
                                      className="gap-2"
                                    >
                                      <Presentation className="w-4 h-4" />
                                      View Presentation
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No applications yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="submissions">
                <div className="glass-card p-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Project Submissions</h2>

                  {projects && projects.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {projects.map((project: any) => (
                        <div
                          key={project.id}
                          className="p-6 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold">{project.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                by {project.team?.team_name || 'Unknown Team'}
                              </p>
                            </div>
                            {project.submitted && (
                              <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
                                Submitted
                              </Badge>
                            )}
                          </div>

                          {project.description && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {project.description}
                            </p>
                          )}

                          {project.tech_stack && project.tech_stack.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-4">
                              {project.tech_stack.slice(0, 5).map((tech: string) => (
                                <Badge key={tech} variant="outline" className="text-xs">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            {project.repo_url && (
                              <a href={project.repo_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline">
                                  <Eye className="w-4 h-4 mr-1" />
                                  GitHub
                                </Button>
                              </a>
                            )}
                            {project.demo_url && (
                              <a href={project.demo_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline">
                                  <Play className="w-4 h-4 mr-1" />
                                  Demo
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No submissions yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="judging">
                <JudgingTab hackathonId={id!} />
              </TabsContent>

              <TabsContent value="settings">
                <div className="glass-card p-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Hackathon Settings</h2>
                  
                  <div className="space-y-6">
                    {/* Gallery Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Image className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Project Gallery</h3>
                          <p className="text-sm text-muted-foreground">
                            Enable the gallery section for participants to submit and view projects
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label htmlFor="gallery-toggle" className="text-sm text-muted-foreground">
                          {hackathon.is_gallery_public ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                          id="gallery-toggle"
                          checked={hackathon.is_gallery_public || false}
                          onCheckedChange={(checked) => toggleGalleryMutation.mutate(checked)}
                          disabled={toggleGalleryMutation.isPending}
                        />
                      </div>
                    </div>

                    {hackathon.is_gallery_public && (
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="text-sm text-green-400">
                          ✓ Gallery is enabled. Accepted participants can now submit their projects and view all submissions in the hackathon page.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </Layout>

      <PresentationViewModal
        open={!!selectedPresentation}
        onOpenChange={(open) => !open && setSelectedPresentation(null)}
        presentationUrl={selectedPresentation?.url || ''}
        teamName={selectedPresentation?.teamName || ''}
      />

      <ApplicationDetailModal
        open={!!selectedApplication}
        onOpenChange={(open) => !open && setSelectedApplication(null)}
        application={selectedApplication}
        onViewPresentation={() => {
          if (selectedApplication?.presentation_url) {
            setSelectedPresentation({
              url: selectedApplication.presentation_url,
              teamName: selectedApplication.team?.team_name || 'Team'
            });
          }
        }}
      />
    </>
  );
}
