import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Users, Loader2, UserPlus, Crown, ArrowLeft } from 'lucide-react';
import { TeamStatusCard } from './TeamStatusCard';
import { PresentationUpload } from './PresentationUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JoinTeamModal } from './JoinTeamModal';

const applicationSchema = z.object({
  teamName: z.string().min(2, 'Team name must be at least 2 characters'),
  projectIdea: z.string().min(10, 'Please describe your project idea'),
  whyJoin: z.string().min(10, 'Tell us why you want to participate'),
  domain: z.string().min(1, 'Please select a domain'),
  teamMembers: z.array(z.object({
    email: z.string().email('Invalid email address'),
  })).optional(),
});

const DOMAIN_OPTIONS = [
  'Web Development',
  'Mobile Development',
  'AI/Machine Learning',
  'Blockchain/Web3',
  'IoT/Hardware',
  'Game Development',
  'Cybersecurity',
  'Data Science',
  'Cloud Computing',
  'AR/VR',
  'FinTech',
  'HealthTech',
  'EdTech',
  'Other',
];

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface ApplicationFormProps {
  hackathonId: string;
  hackathon: {
    title: string;
    min_team_size: number | null;
    max_team_size: number | null;
  };
}

type FormMode = 'select' | 'create';

export function ApplicationForm({ hackathonId, hackathon }: ApplicationFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<FormMode>('select');
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [presentationUrl, setPresentationUrl] = useState<string>('');
  // Check if user is already a member of a team for this hackathon
  const { data: existingTeamMembership, isLoading: isLoadingMembership } = useQuery({
    queryKey: ['user-team-membership-apply', hackathonId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          team:teams!inner(id, team_name, hackathon_id, created_by)
        `)
        .eq('user_id', user!.id)
        .eq('team.hackathon_id', hackathonId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && !!hackathonId,
  });

  // Check if user already has an application for this hackathon
  const { data: existingApplication, isLoading: isLoadingApplication } = useQuery({
    queryKey: ['user-existing-application', hackathonId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('id, status')
        .eq('hackathon_id', hackathonId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user && !!hackathonId,
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      teamName: '',
      projectIdea: '',
      whyJoin: '',
      domain: '',
      teamMembers: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'teamMembers',
  });

  const maxAdditionalMembers = (hackathon.max_team_size || 4) - 1;

  const submitMutation = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          hackathon_id: hackathonId,
          team_name: data.teamName,
          created_by: user!.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      const { error: leaderError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user!.id,
          email: user!.email!,
          role: 'leader',
          accepted: true,
        });

      if (leaderError) throw leaderError;

      if (data.teamMembers && data.teamMembers.length > 0) {
        const membersToInsert = data.teamMembers.map((member) => ({
          team_id: team.id,
          email: member.email,
          role: 'member' as const,
          accepted: false,
        }));

        const { error: membersError } = await supabase
          .from('team_members')
          .insert(membersToInsert);

        if (membersError) throw membersError;
      }

      const { error: appError } = await supabase
        .from('applications')
        .insert({
          hackathon_id: hackathonId,
          team_id: team.id,
          user_id: user!.id,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          application_data: {
            project_idea: data.projectIdea,
            why_join: data.whyJoin,
            domain: data.domain,
          },
          presentation_url: presentationUrl || null,
        });

      if (appError) throw appError;

      // Notify organizers about the new application
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        await supabase.functions.invoke('notify-organizer-application', {
          body: {
            applicationId: team.id,
            hackathonId,
            teamName: data.teamName,
            hasPresentationUrl: !!presentationUrl,
          },
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
        });
      } catch (notifyError) {
        console.error('Failed to notify organizers:', notifyError);
      }

      return team;
    },
    onSuccess: () => {
      toast({
        title: 'Application submitted!',
        description: 'Your team has been registered for this hackathon.',
      });
      queryClient.invalidateQueries({ queryKey: ['user-application'] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      navigate(`/hackathon/${hackathonId}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Submission failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ApplicationFormData) => {
    submitMutation.mutate(data);
  };

  // Show loading state while checking membership and existing application
  if (isLoadingMembership || isLoadingApplication) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 flex items-center justify-center"
      >
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Checking participation status...</span>
      </motion.div>
    );
  }

  // If user already has an application for this hackathon
  if (existingApplication) {
    const statusLabel = existingApplication.status === 'submitted' ? 'pending review' :
                        existingApplication.status === 'accepted' ? 'accepted' :
                        existingApplication.status === 'rejected' ? 'not accepted' :
                        existingApplication.status === 'waitlisted' ? 'waitlisted' : 'submitted';
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 text-center"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold mb-2">Already Applied</h2>
        <p className="text-muted-foreground mb-4">
          You have already submitted an application for {hackathon.title}. 
          Your application is currently <span className="font-medium text-primary">{statusLabel}</span>.
        </p>
        <Link to={`/hackathon/${hackathonId}`}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hackathon
          </Button>
        </Link>
      </motion.div>
    );
  }

  // If user is already part of a team for this hackathon, show team info with members
  if (existingTeamMembership) {
    const team = existingTeamMembership.team as { id: string; team_name: string; hackathon_id: string; created_by: string };
    const isApproved = existingTeamMembership.accepted && existingTeamMembership.join_status === 'accepted';
    const isPending = existingTeamMembership.join_status === 'pending';
    const isLeader = existingTeamMembership.role === 'leader';

    return (
      <TeamStatusCard 
        team={team}
        isApproved={isApproved}
        isPending={isPending}
        isLeader={isLeader}
        hackathonTitle={hackathon.title}
        joinStatus={existingTeamMembership.join_status}
      />
    );
  }

  if (mode === 'select') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8"
        >
          <h2 className="text-2xl font-heading font-bold mb-2">Join {hackathon.title}</h2>
          <p className="text-muted-foreground mb-8">
            Choose how you want to participate in this hackathon
          </p>

          <div className="grid gap-4">
            <button
              onClick={() => setMode('create')}
              className="p-6 rounded-xl border border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                  <Crown className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    Create a Team
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start a new team and invite others to join. You'll be the team leader.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setJoinModalOpen(true)}
              className="p-6 rounded-xl border border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <UserPlus className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    Join Using Code
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Have an invite code? Enter it to join an existing team.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </motion.div>

        <JoinTeamModal
          open={joinModalOpen}
          onOpenChange={setJoinModalOpen}
          hackathonId={hackathonId}
        />
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8"
    >
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setMode('select')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-heading font-bold">Create a Team</h2>
          <p className="text-muted-foreground">
            Fill out the form below to register your team for {hackathon.title}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="teamName">Team Name *</Label>
          <Input
            id="teamName"
            placeholder="Enter your team name"
            {...register('teamName')}
            className="bg-muted/50 border-border"
          />
          {errors.teamName && (
            <p className="text-sm text-destructive">{errors.teamName.message}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Team Members</Label>
            <span className="text-sm text-muted-foreground">
              {fields.length + 1} / {hackathon.max_team_size} members
            </span>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">{profile?.full_name || 'You'}</p>
                <p className="text-sm text-muted-foreground">{user?.email} (Team Leader)</p>
              </div>
            </div>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  placeholder="team-member@email.com"
                  {...register(`teamMembers.${index}.email`)}
                  className="bg-muted/50 border-border"
                />
                {errors.teamMembers?.[index]?.email && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.teamMembers[index]?.email?.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {fields.length < maxAdditionalMembers && (
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ email: '' })}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Team Member
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label>Domain *</Label>
          <Select
            value={watch('domain')}
            onValueChange={(value) => setValue('domain', value)}
          >
            <SelectTrigger className="bg-muted/50 border-border">
              <SelectValue placeholder="Select your project domain" />
            </SelectTrigger>
            <SelectContent>
              {DOMAIN_OPTIONS.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.domain && (
            <p className="text-sm text-destructive">{errors.domain.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectIdea">Project Idea *</Label>
          <Textarea
            id="projectIdea"
            placeholder="Describe your project idea briefly..."
            {...register('projectIdea')}
            className="bg-muted/50 border-border resize-none"
            rows={4}
          />
          {errors.projectIdea && (
            <p className="text-sm text-destructive">{errors.projectIdea.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="whyJoin">Why do you want to participate? *</Label>
          <Textarea
            id="whyJoin"
            placeholder="Tell us what excites you about this hackathon..."
            {...register('whyJoin')}
            className="bg-muted/50 border-border resize-none"
            rows={4}
          />
          {errors.whyJoin && (
            <p className="text-sm text-destructive">{errors.whyJoin.message}</p>
          )}
        </div>

        <PresentationUpload 
          onUploadComplete={setPresentationUrl}
          existingUrl={presentationUrl}
        />

        <Button
          type="submit"
          disabled={submitMutation.isPending}
          className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Application'
          )}
        </Button>
      </form>
    </motion.div>
  );
}
