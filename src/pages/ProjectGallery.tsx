import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Trophy,
  Github,
  ExternalLink,
  Play,
  X,
  Loader2,
  Code2,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';

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
  hackathon: { title: string; id: string } | null;
}

export default function ProjectGallery() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTechStack, setSelectedTechStack] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['gallery-projects'],
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
          team:teams(team_name),
          hackathon:hackathons(id, title)
        `)
        .eq('submitted', true)
        .order('winner_position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Project[];
    },
  });

  // Extract all unique tech stack items
  const allTechStack = useMemo(() => {
    if (!projects) return [];
    const techSet = new Set<string>();
    projects.forEach(project => {
      project.tech_stack?.forEach(tech => techSet.add(tech));
    });
    return Array.from(techSet).sort();
  }, [projects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    return projects.filter(project => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.team?.team_name.toLowerCase().includes(searchQuery.toLowerCase());

      // Tech stack filter
      const matchesTech = selectedTechStack.length === 0 ||
        selectedTechStack.every(tech => project.tech_stack?.includes(tech));

      return matchesSearch && matchesTech;
    });
  }, [projects, searchQuery, selectedTechStack]);

  const toggleTechFilter = (tech: string) => {
    setSelectedTechStack(prev =>
      prev.includes(tech)
        ? prev.filter(t => t !== tech)
        : [...prev, tech]
    );
  };

  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">
              <span className="gradient-text">Project Gallery</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Explore innovative projects built during hackathons. Get inspired by what developers have created.
            </p>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search projects, teams, or descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-primary/20 border-primary' : ''}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter by Tech
                {selectedTechStack.length > 0 && (
                  <Badge className="ml-2 bg-primary text-primary-foreground">
                    {selectedTechStack.length}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Tech Stack Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Filter by Technology</h3>
                      {selectedTechStack.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTechStack([])}
                          className="text-muted-foreground"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Clear all
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allTechStack.map((tech) => (
                        <Badge
                          key={tech}
                          variant={selectedTechStack.includes(tech) ? 'default' : 'outline'}
                          className={`cursor-pointer transition-all ${
                            selectedTechStack.includes(tech)
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => toggleTechFilter(tech)}
                        >
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Projects Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card overflow-hidden group hover:border-primary/50 transition-colors"
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
                      <span>{project.team?.team_name || 'Unknown Team'}</span>
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

                    {/* Hackathon Badge */}
                    {project.hackathon && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <Badge variant="secondary" className="text-xs">
                          {project.hackathon.title}
                        </Badge>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Code2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-heading font-bold mb-2">No projects found</h2>
              <p className="text-muted-foreground">
                {searchQuery || selectedTechStack.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'No projects have been submitted yet'}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
