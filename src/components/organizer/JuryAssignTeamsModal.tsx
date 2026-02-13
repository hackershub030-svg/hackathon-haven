import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface JuryAssignTeamsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judge: any;
  hackathonId: string;
  teams: any[];
  existingAssignments: any[];
  allAssignments: any[];
}

export function JuryAssignTeamsModal({
  open,
  onOpenChange,
  judge,
  hackathonId,
  teams,
  existingAssignments,
  allAssignments,
}: JuryAssignTeamsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  useEffect(() => {
    setSelectedTeams(existingAssignments.map(a => a.team_id));
  }, [existingAssignments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Remove unselected assignments
      const toRemove = existingAssignments
        .filter(a => !selectedTeams.includes(a.team_id))
        .map(a => a.id);

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('judge_team_assignments')
          .delete()
          .in('id', toRemove);
        if (error) throw error;
      }

      // Add new assignments
      const existingTeamIds = existingAssignments.map(a => a.team_id);
      const toAdd = selectedTeams
        .filter(teamId => !existingTeamIds.includes(teamId))
        .map(teamId => ({
          judge_id: judge.id,
          team_id: teamId,
          hackathon_id: hackathonId,
        }));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('judge_team_assignments')
          .insert(toAdd);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-assignments', hackathonId] });
      toast({ title: 'Teams assigned successfully' });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to assign teams', description: error.message, variant: 'destructive' });
    },
  });

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  // Check if a team is assigned to another judge
  const isAssignedToOther = (teamId: string) => {
    return allAssignments.some(a => a.team_id === teamId && a.judge_id !== judge.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto glass-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Assign Teams to {judge.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {teams.length > 0 ? (
            teams.map((team, index) => {
              const assignedToOther = isAssignedToOther(team.id);
              const isSelected = selectedTeams.includes(team.id);
              
              return (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                    assignedToOther 
                      ? 'bg-muted/20 opacity-50' 
                      : isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/30 hover:bg-muted/40'
                  }`}
                  onClick={() => !assignedToOther && toggleTeam(team.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={assignedToOther}
                    onCheckedChange={() => !assignedToOther && toggleTeam(team.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{team.team_name}</p>
                    {team.team_unique_id && (
                      <p className="text-xs text-muted-foreground">ID: {team.team_unique_id}</p>
                    )}
                  </div>
                  {assignedToOther && (
                    <Badge variant="outline" className="text-xs">
                      Assigned to other
                    </Badge>
                  )}
                  {isSelected && !assignedToOther && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </motion.div>
              );
            })
          ) : (
            <p className="text-center text-muted-foreground py-4">No accepted teams available</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-gradient-primary hover:opacity-90"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Save Assignments ({selectedTeams.length} teams)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
