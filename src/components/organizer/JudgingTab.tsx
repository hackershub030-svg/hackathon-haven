import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trophy,
  Star,
  Save,
  Trash2,
  Loader2,
  Award,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface JudgingTabProps {
  hackathonId: string;
}

interface Rubric {
  id: string;
  name: string;
  description: string | null;
  max_score: number;
  weight: number;
  sort_order: number;
}

interface ProjectWithScores {
  id: string;
  title: string;
  description: string | null;
  team: { team_name: string } | null;
  winner_position: number | null;
  scores: {
    rubric_id: string;
    score: number;
    feedback: string | null;
  }[];
  totalScore: number;
}

export function JudgingTab({ hackathonId }: JudgingTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRubricForm, setShowRubricForm] = useState(false);
  const [newRubric, setNewRubric] = useState({ name: '', description: '', max_score: 10, weight: 1 });
  const [scoringProject, setScoringProject] = useState<string | null>(null);
  const [projectScores, setProjectScores] = useState<Record<string, number>>({});

  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ['judging-rubrics', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judging_rubrics')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .order('sort_order');

      if (error) throw error;
      return data as Rubric[];
    },
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['judging-projects', hackathonId],
    queryFn: async () => {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          winner_position,
          team:teams(team_name)
        `)
        .eq('hackathon_id', hackathonId)
        .eq('submitted', true);

      if (projectsError) throw projectsError;

      const { data: scoresData } = await supabase
        .from('project_scores')
        .select('*')
        .in('project_id', projectsData?.map(p => p.id) || []);

      return projectsData?.map(project => {
        const projectScoresData = scoresData?.filter(s => s.project_id === project.id) || [];
        const totalScore = projectScoresData.reduce((acc, s) => {
          const rubric = rubrics?.find(r => r.id === s.rubric_id);
          return acc + (s.score * (rubric?.weight || 1));
        }, 0);

        return {
          ...project,
          scores: projectScoresData,
          totalScore,
        } as ProjectWithScores;
      }).sort((a, b) => b.totalScore - a.totalScore) || [];
    },
    enabled: !!rubrics,
  });

  const addRubricMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('judging_rubrics')
        .insert({
          hackathon_id: hackathonId,
          name: newRubric.name,
          description: newRubric.description || null,
          max_score: newRubric.max_score,
          weight: newRubric.weight,
          sort_order: (rubrics?.length || 0) + 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-rubrics'] });
      setNewRubric({ name: '', description: '', max_score: 10, weight: 1 });
      setShowRubricForm(false);
      toast({ title: 'Rubric added', description: 'Judging criterion has been created.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteRubricMutation = useMutation({
    mutationFn: async (rubricId: string) => {
      const { error } = await supabase
        .from('judging_rubrics')
        .delete()
        .eq('id', rubricId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-rubrics'] });
      toast({ title: 'Rubric deleted' });
    },
  });

  const saveScoresMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const scoresToUpsert = Object.entries(projectScores).map(([rubricId, score]) => ({
        project_id: projectId,
        rubric_id: rubricId,
        judge_id: user?.id,
        score,
      }));

      const { error } = await supabase
        .from('project_scores')
        .upsert(scoresToUpsert, { onConflict: 'project_id,rubric_id,judge_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-projects'] });
      setScoringProject(null);
      setProjectScores({});
      toast({ title: 'Scores saved' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const setWinnerMutation = useMutation({
    mutationFn: async ({ projectId, position }: { projectId: string; position: number | null }) => {
      if (position !== null) {
        await supabase
          .from('projects')
          .update({ winner_position: null })
          .eq('hackathon_id', hackathonId)
          .eq('winner_position', position);
      }

      const { error } = await supabase
        .from('projects')
        .update({ winner_position: position })
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-projects'] });
      toast({ title: 'Winner updated' });
    },
  });

  const startScoring = (project: ProjectWithScores) => {
    setScoringProject(project.id);
    const initialScores: Record<string, number> = {};
    rubrics?.forEach(rubric => {
      const existingScore = project.scores.find(s => s.rubric_id === rubric.id);
      initialScores[rubric.id] = existingScore?.score || 0;
    });
    setProjectScores(initialScores);
  };

  if (rubricsLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rubrics Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-semibold">Scoring Rubrics</h2>
          <Button
            onClick={() => setShowRubricForm(true)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Rubric
          </Button>
        </div>

        <AnimatePresence>
          {showRubricForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-lg bg-muted/30 border border-border"
            >
              <div className="grid gap-4">
                <Input
                  placeholder="Rubric name (e.g., Innovation)"
                  value={newRubric.name}
                  onChange={(e) => setNewRubric({ ...newRubric, name: e.target.value })}
                  className="bg-muted/50"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newRubric.description}
                  onChange={(e) => setNewRubric({ ...newRubric, description: e.target.value })}
                  className="bg-muted/50"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Max Score</label>
                    <Input
                      type="number"
                      value={newRubric.max_score}
                      onChange={(e) => setNewRubric({ ...newRubric, max_score: parseInt(e.target.value) || 10 })}
                      className="bg-muted/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Weight</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newRubric.weight}
                      onChange={(e) => setNewRubric({ ...newRubric, weight: parseFloat(e.target.value) || 1 })}
                      className="bg-muted/50"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => addRubricMutation.mutate()}
                    disabled={!newRubric.name || addRubricMutation.isPending}
                  >
                    {addRubricMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Rubric
                  </Button>
                  <Button variant="outline" onClick={() => setShowRubricForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {rubrics && rubrics.length > 0 ? (
          <div className="space-y-3">
            {rubrics.map((rubric, index) => (
              <motion.div
                key={rubric.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{rubric.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        Max: {rubric.max_score}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Weight: {rubric.weight}x
                      </Badge>
                    </div>
                    {rubric.description && (
                      <p className="text-sm text-muted-foreground mt-1">{rubric.description}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteRubricMutation.mutate(rubric.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No rubrics defined yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add scoring criteria to judge projects</p>
          </div>
        )}
      </div>

      {/* Projects & Scoring Section */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-heading font-semibold mb-6">Projects & Scores</h2>

        {projects && projects.length > 0 ? (
          <div className="space-y-4">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {project.winner_position && (
                        <Badge className={
                          project.winner_position === 1 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                          project.winner_position === 2 ? 'bg-gray-400/20 text-gray-300 border-gray-400/30' :
                          'bg-amber-700/20 text-amber-600 border-amber-700/30'
                        }>
                          <Trophy className="w-3 h-3 mr-1" />
                          {project.winner_position === 1 ? '1st' : project.winner_position === 2 ? '2nd' : '3rd'}
                        </Badge>
                      )}
                      <h3 className="font-semibold">{project.title}</h3>
                      <span className="text-sm text-muted-foreground">
                        by {project.team?.team_name || 'Unknown Team'}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">
                        Total Score: {project.totalScore.toFixed(1)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {scoringProject === project.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => saveScoresMutation.mutate(project.id)}
                          disabled={saveScoresMutation.isPending}
                        >
                          {saveScoresMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setScoringProject(null);
                            setProjectScores({});
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startScoring(project)}
                          disabled={!rubrics || rubrics.length === 0}
                        >
                          <Star className="w-4 h-4 mr-1" />
                          Score
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setWinnerMutation.mutate({ 
                            projectId: project.id, 
                            position: project.winner_position ? null : 1 
                          })}
                        >
                          <Award className="w-4 h-4 mr-1" />
                          {project.winner_position ? 'Remove' : 'Winner'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Scoring UI */}
                <AnimatePresence>
                  {scoringProject === project.id && rubrics && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-border space-y-4"
                    >
                      {rubrics.map((rubric) => (
                        <div key={rubric.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">{rubric.name}</label>
                            <span className="text-sm text-primary font-mono">
                              {projectScores[rubric.id] || 0} / {rubric.max_score}
                            </span>
                          </div>
                          <Slider
                            value={[projectScores[rubric.id] || 0]}
                            onValueChange={([value]) => 
                              setProjectScores({ ...projectScores, [rubric.id]: value })
                            }
                            max={rubric.max_score}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No submitted projects yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
