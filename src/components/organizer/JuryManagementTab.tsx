import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  UserPlus,
  Users,
  Loader2,
  Mail,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { JuryAssignTeamsModal } from './JuryAssignTeamsModal';

interface JuryManagementTabProps {
  hackathonId: string;
}

export function JuryManagementTab({ hackathonId }: JuryManagementTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [juryEmail, setJuryEmail] = useState('');
  const [assigningJudge, setAssigningJudge] = useState<any>(null);

  const { data: judges, isLoading } = useQuery({
    queryKey: ['judges', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['judge-assignments', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_team_assignments')
        .select('*')
        .eq('hackathon_id', hackathonId);

      if (error) throw error;
      return data;
    },
  });

  const { data: acceptedTeams } = useQuery({
    queryKey: ['accepted-teams', hackathonId],
    queryFn: async () => {
      // Get teams that have accepted applications
      const { data: apps, error: appsError } = await supabase
        .from('applications')
        .select('team_id')
        .eq('hackathon_id', hackathonId)
        .eq('status', 'accepted');

      if (appsError) throw appsError;
      
      const teamIds = apps?.map(a => a.team_id).filter(Boolean) as string[];
      if (teamIds.length === 0) return [];

      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, team_name, team_unique_id')
        .in('id', teamIds);

      if (teamsError) throw teamsError;
      return teams || [];
    },
  });

  const addJudgeMutation = useMutation({
    mutationFn: async (email: string) => {
      // Check if user exists by email in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();

      const { error } = await supabase
        .from('judges')
        .insert({
          hackathon_id: hackathonId,
          email,
          user_id: profile?.user_id || null,
          added_by: user!.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges', hackathonId] });
      setJuryEmail('');
      toast({ title: 'Judge added successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to add judge', 
        description: error.message?.includes('duplicate') ? 'This judge is already added' : error.message,
        variant: 'destructive' 
      });
    },
  });

  const removeJudgeMutation = useMutation({
    mutationFn: async (judgeId: string) => {
      const { error } = await supabase
        .from('judges')
        .delete()
        .eq('id', judgeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges', hackathonId] });
      queryClient.invalidateQueries({ queryKey: ['judge-assignments', hackathonId] });
      toast({ title: 'Judge removed' });
    },
  });

  const getAssignmentCount = (judgeId: string) => {
    return assignments?.filter(a => a.judge_id === judgeId).length || 0;
  };

  return (
    <div className="space-y-6">
      {/* Add Jury Section */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Add Jury Member
        </h2>
        <div className="flex gap-3">
          <Input
            type="email"
            placeholder="Enter jury member's email"
            value={juryEmail}
            onChange={(e) => setJuryEmail(e.target.value)}
            className="bg-muted/50 border-border flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && juryEmail) {
                addJudgeMutation.mutate(juryEmail);
              }
            }}
          />
          <Button
            onClick={() => addJudgeMutation.mutate(juryEmail)}
            disabled={!juryEmail || addJudgeMutation.isPending}
            className="bg-gradient-primary hover:opacity-90"
          >
            {addJudgeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add
          </Button>
        </div>
      </div>

      {/* Jury List */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Jury Members ({judges?.length || 0})
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : judges && judges.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {judges.map((judge, index) => (
                <motion.div
                  key={judge.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{judge.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getAssignmentCount(judge.id)} teams assigned
                        </Badge>
                        {judge.user_id && (
                          <Badge className="text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Linked
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAssigningJudge(judge)}
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Assign Teams
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeJudgeMutation.mutate(judge.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No jury members added yet</p>
          </div>
        )}
      </div>

      {/* Assign Teams Modal */}
      {assigningJudge && (
        <JuryAssignTeamsModal
          open={!!assigningJudge}
          onOpenChange={(open) => !open && setAssigningJudge(null)}
          judge={assigningJudge}
          hackathonId={hackathonId}
          teams={acceptedTeams || []}
          existingAssignments={assignments?.filter(a => a.judge_id === assigningJudge.id) || []}
          allAssignments={assignments || []}
        />
      )}
    </div>
  );
}
