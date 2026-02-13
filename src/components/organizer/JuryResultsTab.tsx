import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Trophy,
  Users,
  Loader2,
  Eye,
  BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface JuryResultsTabProps {
  hackathonId: string;
}

export function JuryResultsTab({ hackathonId }: JuryResultsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [editingScores, setEditingScores] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);

  const { data: judges } = useQuery({
    queryKey: ['judges', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .eq('hackathon_id', hackathonId);
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

  const { data: scores } = useQuery({
    queryKey: ['judge-scores', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_scores')
        .select('*')
        .eq('hackathon_id', hackathonId);
      if (error) throw error;
      return data;
    },
  });

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

  const { data: teams } = useQuery({
    queryKey: ['accepted-teams', hackathonId],
    queryFn: async () => {
      const { data: apps } = await supabase
        .from('applications')
        .select('team_id')
        .eq('hackathon_id', hackathonId)
        .eq('status', 'accepted');
      
      const teamIds = apps?.map(a => a.team_id).filter(Boolean) as string[];
      if (!teamIds?.length) return [];

      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name')
        .in('id', teamIds);
      if (error) throw error;
      return data;
    },
  });

  const updateScoreMutation = useMutation({
    mutationFn: async ({ scoreId, newScore }: { scoreId: string; newScore: number }) => {
      const { error } = await supabase
        .from('judge_scores')
        .update({ score: newScore })
        .eq('id', scoreId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-scores', hackathonId] });
      toast({ title: 'Score updated' });
    },
  });

  // Calculate evaluated teams per judge
  const getJudgeStats = (judgeId: string) => {
    const judgeAssignments = assignments?.filter(a => a.judge_id === judgeId) || [];
    const totalAssigned = judgeAssignments.length;
    
    // A team is "evaluated" if all rubrics have submitted scores
    const evaluatedTeams = judgeAssignments.filter(assignment => {
      const teamScores = scores?.filter(
        s => s.judge_id === judgeId && s.team_id === assignment.team_id && s.submitted
      ) || [];
      return teamScores.length > 0 && teamScores.length >= (rubrics?.length || 0);
    }).length;

    return { totalAssigned, evaluatedTeams };
  };

  // Get all submitted evaluations grouped by team
  const evaluatedTeams = (() => {
    if (!scores || !teams || !judges) return [];

    const submittedScores = scores.filter(s => s.submitted);
    const teamScoreMap = new Map<string, { judgeId: string; totalScore: number; scores: any[] }[]>();

    submittedScores.forEach(score => {
      const key = `${score.team_id}-${score.judge_id}`;
      if (!teamScoreMap.has(score.team_id)) {
        teamScoreMap.set(score.team_id, []);
      }
      const entries = teamScoreMap.get(score.team_id)!;
      let entry = entries.find(e => e.judgeId === score.judge_id);
      if (!entry) {
        entry = { judgeId: score.judge_id, totalScore: 0, scores: [] };
        entries.push(entry);
      }
      const rubric = rubrics?.find(r => r.id === score.rubric_id);
      entry.totalScore += score.score * (rubric?.weight || 1);
      entry.scores.push(score);
    });

    const results: any[] = [];
    teamScoreMap.forEach((judgeEntries, teamId) => {
      const team = teams?.find(t => t.id === teamId);
      judgeEntries.forEach(entry => {
        const judge = judges?.find(j => j.id === entry.judgeId);
        if (entry.scores.length >= (rubrics?.length || 0)) {
          results.push({
            teamId,
            teamName: team?.team_name || 'Unknown',
            judgeName: judge?.email || 'Unknown',
            judgeId: entry.judgeId,
            totalScore: entry.totalScore,
            scores: entry.scores,
          });
        }
      });
    });

    return results.sort((a, b) => b.totalScore - a.totalScore);
  })();

  const totalEvaluated = new Set(evaluatedTeams.map(e => e.teamId)).size;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-heading font-semibold">Evaluation Summary</h2>
        </div>
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 mb-6">
          <p className="text-lg font-semibold">
            Total Teams Evaluated: <span className="text-primary">{totalEvaluated}</span>
          </p>
        </div>

        {/* Judge stats - 4 per row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {judges?.map((judge, index) => {
            const stats = getJudgeStats(judge.id);
            return (
              <motion.div
                key={judge.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-lg bg-muted/30 text-center"
              >
                <p className="font-medium text-sm truncate">{judge.email.split('@')[0]}</p>
                <p className="text-lg font-bold text-primary mt-1">
                  {stats.evaluatedTeams}/{stats.totalAssigned}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Evaluated Teams */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Submitted Evaluations
        </h2>

        {evaluatedTeams.length > 0 ? (
          <div className="space-y-3">
            {evaluatedTeams.map((result, index) => (
              <motion.div
                key={`${result.teamId}-${result.judgeId}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedResult(result);
                  setIsEditing(false);
                  const initialScores: Record<string, number> = {};
                  result.scores.forEach((s: any) => {
                    initialScores[s.id] = s.score;
                  });
                  setEditingScores(initialScores);
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{result.teamName}</p>
                    <p className="text-xs text-muted-foreground">
                      Evaluated by: {result.judgeName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">
                    Score: {result.totalScore.toFixed(1)}
                  </Badge>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No evaluations submitted yet</p>
          </div>
        )}
      </div>

      {/* Score Detail Modal (Editable for organizer) */}
      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-lg glass-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              {selectedResult?.teamName} - Evaluation
            </DialogTitle>
          </DialogHeader>

          {selectedResult && rubrics && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Evaluated by: <span className="text-foreground">{selectedResult.judgeName}</span>
              </p>

              {rubrics.map((rubric) => {
                const scoreEntry = selectedResult.scores.find((s: any) => s.rubric_id === rubric.id);
                const currentScore = isEditing ? (editingScores[scoreEntry?.id] ?? scoreEntry?.score ?? 0) : (scoreEntry?.score ?? 0);

                return (
                  <div key={rubric.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{rubric.name}</label>
                      <span className="text-sm text-primary font-mono">
                        {currentScore} / {rubric.max_score}
                      </span>
                    </div>
                    {isEditing ? (
                      <Slider
                        value={[currentScore]}
                        onValueChange={([value]) => {
                          if (scoreEntry) {
                            setEditingScores(prev => ({ ...prev, [scoreEntry.id]: value }));
                          }
                        }}
                        max={rubric.max_score}
                        step={1}
                        className="w-full"
                      />
                    ) : (
                      <div className="w-full bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${(currentScore / rubric.max_score) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                <p className="text-sm text-muted-foreground">Total Score</p>
                <p className="text-2xl font-bold text-primary">
                  {isEditing
                    ? selectedResult.scores.reduce((acc: number, s: any) => {
                        const rubric = rubrics.find(r => r.id === s.rubric_id);
                        return acc + (editingScores[s.id] ?? s.score) * (rubric?.weight || 1);
                      }, 0).toFixed(1)
                    : selectedResult.totalScore.toFixed(1)
                  }
                </p>
              </div>

              <div className="flex justify-end gap-2">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button
                      className="bg-gradient-primary hover:opacity-90"
                      onClick={async () => {
                        for (const [scoreId, newScore] of Object.entries(editingScores)) {
                          const original = selectedResult.scores.find((s: any) => s.id === scoreId);
                          if (original && original.score !== newScore) {
                            await updateScoreMutation.mutateAsync({ scoreId, newScore });
                          }
                        }
                        setIsEditing(false);
                        setSelectedResult(null);
                      }}
                    >
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Scores
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
