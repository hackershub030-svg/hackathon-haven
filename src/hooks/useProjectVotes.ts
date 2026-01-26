import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useProjectVotes(projectId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get vote count for this project
  const { data: voteCount = 0 } = useQuery({
    queryKey: ['project-votes-count', projectId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('project_votes')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);

      if (error) throw error;
      return count || 0;
    },
  });

  // Check if current user has voted
  const { data: hasVoted = false } = useQuery({
    queryKey: ['project-user-vote', projectId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from('project_votes')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  const voteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in to vote');

      if (hasVoted) {
        // Remove vote
        const { error } = await supabase
          .from('project_votes')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add vote
        const { error } = await supabase
          .from('project_votes')
          .insert({
            project_id: projectId,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-votes-count', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-user-vote', projectId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleVote = () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to vote for projects',
        variant: 'destructive',
      });
      return;
    }
    voteMutation.mutate();
  };

  return {
    voteCount,
    hasVoted,
    toggleVote,
    isVoting: voteMutation.isPending,
  };
}
