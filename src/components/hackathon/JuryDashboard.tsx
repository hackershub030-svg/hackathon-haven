import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Star,
  Users,
  Loader2,
  CheckCircle2,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface JuryDashboardProps {
  hackathonId: string;
}

export function JuryDashboard({ hackathonId }: JuryDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Check if user is a judge for this hackathon
  const { data: judgeRecord, isLoading: judgeLoading } = useQuery({
    queryKey: ['my-judge-record', hackathonId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get assigned teams
  const { data: assignedTeams, isLoading: teamsLoading } = useQuery({
    queryKey: ['my-judge-assignments', hackathonId, judgeRecord?.id],
    queryFn: async () => {
      const { data: assignmentData, error: assignError } = await supabase
        .from('judge_team_assignments')
        .select('team_id')
        .eq('judge_id', judgeRecord!.id)
        .eq('hackathon_id', hackathonId);

      if (assignError) throw assignError;
      if (!assignmentData?.length) return [];

      const teamIds = assignmentData.map(a => a.team_id);
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, team_name, team_unique_id')
        .in('id', teamIds);

      if (teamsError) throw teamsError;

      // Get applications for abstract
      const { data: apps } = await supabase
        .from('applications')
        .select('team_id, abstract, application_data')
        .eq('hackathon_id', hackathonId)
        .in('team_id', teamIds);

      return teams?.map(team => {
        const app = apps?.find(a => a.team_id === team.id);
        const appData = app?.application_data as Record<string, any> | null;
        return {
          ...team,
          abstract: app?.abstract || appData?.project_idea || '',
        };
      }) || [];
    },
    enabled: !!judgeRecord?.id,
  });

  // Get rubrics
  const { data: rubrics } = useQuery({
    queryKey: ['judging-rubrics', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judging_rubrics')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  // Get existing scores
  const { data: existingScores } = useQuery({
    queryKey: ['my-judge-scores', hackathonId, judgeRecord?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_scores')
        .select('*')
        .eq('judge_id', judgeRecord!.id)
        .eq('hackathon_id', hackathonId);
      if (error) throw error;
      return data;
    },
    enabled: !!judgeRecord?.id,
  });

  const submitScoresMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const scoresToUpsert = Object.entries(scores).map(([rubricId, score]) => ({
        judge_id: judgeRecord!.id,
        team_id: teamId,
        hackathon_id: hackathonId,
        rubric_id: rubricId,
        score,
        submitted: true,
      }));

      // Upsert scores
      for (const scoreData of scoresToUpsert) {
        const { error } = await supabase
          .from('judge_scores')
          .upsert(scoreData, { onConflict: 'judge_id,team_id,rubric_id' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-judge-scores'] });
      setSelectedTeam(null);
      setScores({});
      toast({ title: 'Evaluation submitted!', description: 'Your scores have been recorded.' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
    },
  });

  const openTeamEvaluation = (team: any) => {
    setSelectedTeam(team);
    // Load existing scores for this team
    const initialScores: Record<string, number> = {};
    rubrics?.forEach(rubric => {
      const existing = existingScores?.find(
        s => s.team_id === team.id && s.rubric_id === rubric.id
      );
      initialScores[rubric.id] = existing?.score || 0;
    });
    setScores(initialScores);
  };

  const isTeamEvaluated = (teamId: string) => {
    const teamScores = existingScores?.filter(s => s.team_id === teamId && s.submitted) || [];
    return teamScores.length >= (rubrics?.length || 0) && teamScores.length > 0;
  };

  const allRubricsScored = rubrics?.every(r => scores[r.id] !== undefined && scores[r.id] > 0) || false;

  const totalScore = rubrics?.reduce((acc, rubric) => {
    return acc + (scores[rubric.id] || 0) * rubric.weight;
  }, 0) || 0;

  if (judgeLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!judgeRecord) {
    return null; // Not a judge
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <h2 className="text-2xl font-heading font-bold mb-2 flex items-center gap-2">
          <Star className="w-6 h-6 text-primary" />
          Judging Panel
        </h2>
        <p className="text-muted-foreground mb-6">
          Evaluate the teams assigned to you. Click on a team to score them.
        </p>

        {teamsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : assignedTeams && assignedTeams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {assignedTeams.map((team, index) => {
              const evaluated = isTeamEvaluated(team.id);
              return (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                    evaluated
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-muted/30 border-border hover:border-primary/50'
                  }`}
                  onClick={() => !evaluated && openTeamEvaluation(team)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Users className="w-5 h-5 text-primary" />
                    {evaluated && (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{team.team_name}</h3>
                  {team.team_unique_id && (
                    <p className="text-xs text-muted-foreground">ID: {team.team_unique_id}</p>
                  )}
                  {evaluated ? (
                    <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      Evaluated
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-2 text-xs">
                      Pending
                    </Badge>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No teams assigned to you yet</p>
          </div>
        )}
      </motion.div>

      {/* Evaluation Modal */}
      <Dialog open={!!selectedTeam} onOpenChange={(open) => !open && setSelectedTeam(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto glass-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Trophy className="w-5 h-5 text-primary" />
              {selectedTeam?.team_name}
            </DialogTitle>
          </DialogHeader>

          {selectedTeam && rubrics && (
            <div className="space-y-6">
              {/* Abstract */}
              {selectedTeam.abstract && (
                <div className="p-4 rounded-lg bg-muted/30">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Abstract / Project Idea</h4>
                  <p className="text-sm">{selectedTeam.abstract}</p>
                </div>
              )}

              {/* Scoring rubrics */}
              <div className="space-y-4">
                <h4 className="font-semibold">Judging Sheet</h4>
                {rubrics.map((rubric) => (
                  <div key={rubric.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">{rubric.name}</label>
                        {rubric.description && (
                          <p className="text-xs text-muted-foreground">{rubric.description}</p>
                        )}
                      </div>
                      <span className="text-sm text-primary font-mono">
                        {scores[rubric.id] || 0} / {rubric.max_score}
                      </span>
                    </div>
                    <Slider
                      value={[scores[rubric.id] || 0]}
                      onValueChange={([value]) =>
                        setScores(prev => ({ ...prev, [rubric.id]: value }))
                      }
                      max={rubric.max_score}
                      step={1}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              {/* Total Score */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-center">
                <p className="text-sm text-muted-foreground">Total Score (weighted)</p>
                <p className="text-3xl font-bold text-primary">{totalScore.toFixed(1)}</p>
              </div>

              {/* Submit Button */}
              <Button
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={!allRubricsScored || submitScoresMutation.isPending}
                onClick={() => submitScoresMutation.mutate(selectedTeam.id)}
              >
                {submitScoresMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {allRubricsScored ? 'Submit Evaluation' : 'Score all criteria to submit'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
