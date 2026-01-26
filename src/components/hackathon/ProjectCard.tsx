import { motion } from 'framer-motion';
import {
  Trophy,
  Github,
  ExternalLink,
  Play,
  Code2,
  Users,
  Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjectVotes } from '@/hooks/useProjectVotes';
import { cn } from '@/lib/utils';

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

interface ProjectCardProps {
  project: Project;
  index: number;
  onClick?: () => void;
}

export function ProjectCard({ project, index, onClick }: ProjectCardProps) {
  const { voteCount, hasVoted, toggleVote, isVoting } = useProjectVotes(project.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Project Image */}
      <div className="aspect-video bg-muted/30 relative overflow-hidden">
        {project.screenshots && project.screenshots[0] ? (
          <img
            src={project.screenshots[0]}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Code2 className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Winner Badge */}
        {project.winner_position && (
          <div className="absolute top-3 left-3">
            <Badge className={`${
              project.winner_position === 1 
                ? 'bg-yellow-500/90 text-yellow-950' 
                : project.winner_position === 2 
                ? 'bg-gray-400/90 text-gray-950' 
                : 'bg-amber-700/90 text-amber-100'
            }`}>
              <Trophy className="w-3 h-3 mr-1" />
              {project.winner_position === 1 ? '1st Place' : 
               project.winner_position === 2 ? '2nd Place' : '3rd Place'}
            </Badge>
          </div>
        )}

        {/* Vote Button Overlay */}
        <div className="absolute top-3 right-3">
          <Button
            size="sm"
            variant={hasVoted ? "default" : "outline"}
            onClick={toggleVote}
            disabled={isVoting}
            className={cn(
              "gap-1.5 transition-all",
              hasVoted && "bg-red-500 hover:bg-red-600 border-red-500"
            )}
          >
            <Heart className={cn("w-4 h-4", hasVoted && "fill-current")} />
            {voteCount}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-heading font-semibold text-lg line-clamp-1">
            {project.title}
          </h3>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="w-4 h-4" />
          <span>{project.team?.team_name || 'Solo Project'}</span>
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {project.description}
          </p>
        )}

        {/* Tech Stack */}
        {project.tech_stack && project.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {project.tech_stack.slice(0, 4).map((tech) => (
              <Badge 
                key={tech} 
                variant="outline" 
                className="text-xs"
              >
                {tech}
              </Badge>
            ))}
            {project.tech_stack.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{project.tech_stack.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {project.repo_url && (
            <a href={project.repo_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <Github className="w-4 h-4 mr-1" />
                Code
              </Button>
            </a>
          )}
          {project.demo_url && (
            <a href={project.demo_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-1" />
                Demo
              </Button>
            </a>
          )}
          {project.video_url && (
            <a href={project.video_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <Play className="w-4 h-4 mr-1" />
                Video
              </Button>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
