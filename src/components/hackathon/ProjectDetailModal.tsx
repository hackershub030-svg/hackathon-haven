import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Trophy,
  Github,
  ExternalLink,
  Play,
  Users,
  Heart,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
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

interface ProjectDetailModalProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailModal({ project, open, onOpenChange }: ProjectDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { voteCount, hasVoted, toggleVote, isVoting } = useProjectVotes(project?.id || '');

  if (!project) return null;

  const screenshots = project.screenshots || [];
  const hasMultipleImages = screenshots.length > 1;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % screenshots.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <ScrollArea className="max-h-[90vh]">
          {/* Image Gallery */}
          {screenshots.length > 0 && (
            <div className="relative aspect-video bg-muted">
              <img
                src={screenshots[currentImageIndex]}
                alt={`${project.title} screenshot ${currentImageIndex + 1}`}
                className="w-full h-full object-contain"
              />
              
              {/* Navigation Arrows */}
              {hasMultipleImages && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80"
                    onClick={nextImage}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
              
              {/* Image Indicators */}
              {hasMultipleImages && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {screenshots.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        index === currentImageIndex
                          ? "bg-primary"
                          : "bg-muted-foreground/50 hover:bg-muted-foreground"
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Winner Badge */}
              {project.winner_position && (
                <div className="absolute top-4 left-4">
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
            </div>
          )}

          {/* Thumbnails */}
          {hasMultipleImages && (
            <div className="flex gap-2 p-4 bg-muted/30 overflow-x-auto">
              {screenshots.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={cn(
                    "flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-colors",
                    index === currentImageIndex
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground"
                  )}
                >
                  <img
                    src={url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="p-6 space-y-6">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-2xl font-heading">{project.title}</DialogTitle>
                  <div className="flex items-center gap-2 text-muted-foreground mt-2">
                    <Users className="w-4 h-4" />
                    <span>{project.team?.team_name || 'Solo Project'}</span>
                  </div>
                </div>
                <Button
                  variant={hasVoted ? "default" : "outline"}
                  onClick={toggleVote}
                  disabled={isVoting}
                  className={cn(
                    "gap-2",
                    hasVoted && "bg-red-500 hover:bg-red-600 border-red-500"
                  )}
                >
                  <Heart className={cn("w-4 h-4", hasVoted && "fill-current")} />
                  {voteCount} votes
                </Button>
              </div>
            </DialogHeader>

            {/* Description */}
            {project.description && (
              <div>
                <h3 className="font-semibold mb-2">About the Project</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
              </div>
            )}

            {/* Tech Stack */}
            {project.tech_stack && project.tech_stack.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {project.tech_stack.map((tech) => (
                    <Badge key={tech} variant="secondary" className="text-sm">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              {project.repo_url && (
                <a href={project.repo_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <Github className="w-4 h-4" />
                    View Source Code
                  </Button>
                </a>
              )}
              {project.demo_url && (
                <a href={project.demo_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Live Demo
                  </Button>
                </a>
              )}
              {project.video_url && (
                <a href={project.video_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <Play className="w-4 h-4" />
                    Watch Video
                  </Button>
                </a>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
