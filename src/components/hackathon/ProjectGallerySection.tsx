import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Code2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProjectCard } from './ProjectCard';

interface Project {
  id: string;
  title: string;
  description: string | null;
  repo_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  screenshots: string[] | null;
  tech_stack: string[] | null;
  winner_position: number | null;
  team: { team_name: string } | null;
}

interface ProjectGallerySectionProps {
  hackathonId: string;
}

export function ProjectGallerySection({ hackathonId }: ProjectGallerySectionProps) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['hackathon-gallery-projects', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          repo_url,
          demo_url,
          video_url,
          screenshots,
          tech_stack,
          winner_position,
          team:teams(team_name)
        `)
        .eq('hackathon_id', hackathonId)
        .eq('submitted', true)
        .order('winner_position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Project[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16"
      >
        <Code2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-heading font-bold mb-2">No projects yet</h2>
        <p className="text-muted-foreground">
          No projects have been submitted for this hackathon yet.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {projects.map((project, index) => (
        <ProjectCard key={project.id} project={project} index={index} />
      ))}
    </div>
  );
}
