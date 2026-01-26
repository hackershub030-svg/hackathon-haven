import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Users, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const applicationSchema = z.object({
  teamName: z.string().min(2, 'Team name must be at least 2 characters'),
  projectIdea: z.string().min(10, 'Please describe your project idea'),
  whyJoin: z.string().min(10, 'Tell us why you want to participate'),
  teamMembers: z.array(z.object({
    email: z.string().email('Invalid email address'),
  })).optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface ApplicationFormProps {
  hackathonId: string;
  hackathon: {
    title: string;
    min_team_size: number | null;
    max_team_size: number | null;
  };
}

export function ApplicationForm({ hackathonId, hackathon }: ApplicationFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSoloApplication, setIsSoloApplication] = useState(hackathon.min_team_size === 1);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      teamName: '',
      projectIdea: '',
      whyJoin: '',
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
      // 1. Create team
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

      // 2. Add leader as team member
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

      // 3. Add other team members (invites)
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

      // 4. Create application
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
          },
        });

      if (appError) throw appError;

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8"
    >
      <h2 className="text-2xl font-heading font-bold mb-2">Apply for {hackathon.title}</h2>
      <p className="text-muted-foreground mb-6">
        Fill out the form below to register your team
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Team Name */}
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

        {/* Team Members */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Team Members</Label>
            <span className="text-sm text-muted-foreground">
              {fields.length + 1} / {hackathon.max_team_size} members
            </span>
          </div>

          {/* Leader (current user) */}
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

          {/* Additional members */}
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

          <p className="text-sm text-muted-foreground">
            Team members will receive an invitation to join your team.
          </p>
        </div>

        {/* Project Idea */}
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

        {/* Why Join */}
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
