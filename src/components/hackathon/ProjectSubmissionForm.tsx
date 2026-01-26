import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Plus,
  X,
  Edit,
  Save,
  Github,
  ExternalLink,
  Play,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useScreenshotUpload } from '@/hooks/useScreenshotUpload';
import { supabase } from '@/integrations/supabase/client';

const projectSchema = z.object({
  title: z.string().trim().min(1, 'Project title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().trim().max(1000, 'Description must be less than 1000 characters').optional(),
  repo_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  demo_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  video_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectSubmissionFormProps {
  hackathonId: string;
  teamId?: string;
}

export function ProjectSubmissionForm({ hackathonId, teamId }: ProjectSubmissionFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [techInput, setTechInput] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadScreenshots, deleteScreenshot, isUploading } = useScreenshotUpload();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: '',
      description: '',
      repo_url: '',
      demo_url: '',
      video_url: '',
    },
  });

  // Check if user already has a project for this hackathon
  const { data: existingProject, isLoading: projectLoading } = useQuery({
    queryKey: ['user-project', hackathonId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!hackathonId,
  });

  // Populate form with existing data
  useEffect(() => {
    if (existingProject) {
      form.reset({
        title: existingProject.title || '',
        description: existingProject.description || '',
        repo_url: existingProject.repo_url || '',
        demo_url: existingProject.demo_url || '',
        video_url: existingProject.video_url || '',
      });
      setTechStack(existingProject.tech_stack || []);
      setScreenshots(existingProject.screenshots || []);
    }
  }, [existingProject, form]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const uploadedUrls = await uploadScreenshots(Array.from(files));
    if (uploadedUrls.length > 0) {
      setScreenshots(prev => [...prev, ...uploadedUrls]);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveScreenshot = async (url: string) => {
    await deleteScreenshot(url);
    setScreenshots(prev => prev.filter(s => s !== url));
  };

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const { error } = await supabase.from('projects').insert({
        hackathon_id: hackathonId,
        user_id: user!.id,
        team_id: teamId || null,
        title: data.title,
        description: data.description || null,
        repo_url: data.repo_url || null,
        demo_url: data.demo_url || null,
        video_url: data.video_url || null,
        tech_stack: techStack,
        screenshots: screenshots,
        submitted: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-project'] });
      queryClient.invalidateQueries({ queryKey: ['hackathon-gallery-projects'] });
      toast({ title: 'Success!', description: 'Your project has been submitted.' });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const { error } = await supabase
        .from('projects')
        .update({
          title: data.title,
          description: data.description || null,
          repo_url: data.repo_url || null,
          demo_url: data.demo_url || null,
          video_url: data.video_url || null,
          tech_stack: techStack,
          screenshots: screenshots,
          submitted: true,
        })
        .eq('id', existingProject!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-project'] });
      queryClient.invalidateQueries({ queryKey: ['hackathon-gallery-projects'] });
      toast({ title: 'Success!', description: 'Your project has been updated.' });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    if (existingProject) {
      updateProjectMutation.mutate(data);
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const addTech = () => {
    const trimmedTech = techInput.trim();
    if (trimmedTech && !techStack.includes(trimmedTech)) {
      setTechStack([...techStack, trimmedTech]);
      setTechInput('');
    }
  };

  const removeTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech));
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show existing project view if not editing
  if (existingProject && !isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-heading font-semibold">{existingProject.title}</h3>
            <Badge className="mt-2 bg-green-500/20 text-green-400 border border-green-500/30">
              Submitted
            </Badge>
          </div>
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>

        {existingProject.description && (
          <p className="text-muted-foreground mb-4">{existingProject.description}</p>
        )}

        {existingProject.screenshots && existingProject.screenshots.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {existingProject.screenshots.map((url: string, index: number) => (
              <div key={url} className="aspect-video rounded-md overflow-hidden border border-border">
                <img
                  src={url}
                  alt={`Screenshot ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {existingProject.tech_stack && existingProject.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {existingProject.tech_stack.map((tech: string) => (
              <Badge key={tech} variant="outline">{tech}</Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {existingProject.repo_url && (
            <a href={existingProject.repo_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </a>
          )}
          {existingProject.demo_url && (
            <a href={existingProject.demo_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Demo
              </Button>
            </a>
          )}
          {existingProject.video_url && (
            <a href={existingProject.video_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <Play className="w-4 h-4 mr-2" />
                Video
              </Button>
            </a>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-heading font-semibold">
          {existingProject ? 'Edit Your Project' : 'Submit Your Project'}
        </h3>
        {existingProject && (
          <Button variant="ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Title *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your project title"
                    className="bg-muted/50 border-border"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your project..."
                    className="bg-muted/50 border-border min-h-[120px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tech Stack */}
          <div className="space-y-2">
            <FormLabel>Tech Stack</FormLabel>
            <div className="flex gap-2">
              <Input
                placeholder="Add technology (e.g., React)"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTech();
                  }
                }}
                className="bg-muted/50 border-border"
              />
              <Button type="button" variant="outline" onClick={addTech}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {techStack.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {techStack.map((tech) => (
                  <Badge key={tech} variant="secondary" className="flex items-center gap-1">
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTech(tech)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Screenshots Upload */}
          <div className="space-y-2">
            <FormLabel>Screenshots</FormLabel>
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {isUploading ? 'Uploading...' : 'Upload Screenshots'}
              </Button>
              
              {screenshots.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {screenshots.map((url, index) => (
                    <div key={url} className="relative group aspect-video rounded-md overflow-hidden border border-border">
                      <img
                        src={url}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveScreenshot(url)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {screenshots.length === 0 && (
                <div className="border border-dashed border-border rounded-md p-4 text-center">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No screenshots uploaded yet. Add some to showcase your project!
                  </p>
                </div>
              )}
            </div>
          </div>

          <FormField
            control={form.control}
            name="repo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GitHub Repository URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://github.com/..."
                    className="bg-muted/50 border-border"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="demo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Demo URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://..."
                    className="bg-muted/50 border-border"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="video_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Video URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://youtube.com/... or https://loom.com/..."
                    className="bg-muted/50 border-border"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
            disabled={createProjectMutation.isPending || updateProjectMutation.isPending}
          >
            {createProjectMutation.isPending || updateProjectMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {existingProject ? 'Update Project' : 'Submit Project'}
          </Button>
        </form>
      </Form>
    </motion.div>
  );
}
