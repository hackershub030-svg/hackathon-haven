import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Upload,
  Github,
  Globe,
  Video,
  Plus,
  X,
  Loader2,
  Image as ImageIcon,
  Save,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const projectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  repo_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  demo_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  video_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const SUGGESTED_TECH = [
  'React', 'TypeScript', 'Node.js', 'Python', 'TensorFlow', 'OpenAI',
  'Next.js', 'Tailwind CSS', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker',
  'Kubernetes', 'AWS', 'GCP', 'Firebase', 'Supabase', 'GraphQL', 'Rust', 'Go',
];

export default function ProjectSubmission() {
  const { hackathonId, teamId } = useParams<{ hackathonId: string; teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [techStack, setTechStack] = useState<string[]>([]);
  const [newTech, setNewTech] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  });

  // Fetch existing project
  const { data: existingProject, isLoading: projectLoading } = useQuery({
    queryKey: ['project', hackathonId, teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .eq('team_id', teamId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        reset({
          title: data.title,
          description: data.description || '',
          repo_url: data.repo_url || '',
          demo_url: data.demo_url || '',
          video_url: data.video_url || '',
        });
        setTechStack(data.tech_stack || []);
        setScreenshots(data.screenshots || []);
      }

      return data;
    },
    enabled: !!hackathonId && !!teamId,
  });

  const { data: hackathon } = useQuery({
    queryKey: ['hackathon', hackathonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hackathons')
        .select('title')
        .eq('id', hackathonId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!hackathonId,
  });

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (screenshots.length + files.length > 5) {
      toast({
        title: 'Too many screenshots',
        description: 'You can upload up to 5 screenshots',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }

        if (file.size > 5 * 1024 * 1024) {
          throw new Error('File size must be under 5MB');
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${hackathonId}/${teamId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('project-assets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project-assets')
          .getPublicUrl(fileName);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setScreenshots([...screenshots, ...urls]);

      toast({
        title: 'Screenshots uploaded!',
        description: `${urls.length} screenshot(s) added successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const addTech = () => {
    if (newTech.trim() && !techStack.includes(newTech.trim())) {
      setTechStack([...techStack, newTech.trim()]);
      setNewTech('');
    }
  };

  const removeTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech));
  };

  const saveMutation = useMutation({
    mutationFn: async ({ data, submit }: { data: ProjectFormData; submit: boolean }) => {
      const projectData = {
        hackathon_id: hackathonId,
        team_id: teamId,
        user_id: user!.id,
        title: data.title,
        description: data.description,
        repo_url: data.repo_url || null,
        demo_url: data.demo_url || null,
        video_url: data.video_url || null,
        tech_stack: techStack,
        screenshots,
        submitted: submit,
      };

      if (existingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', existingProject.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('projects').insert(projectData);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.submit ? 'Project submitted!' : 'Draft saved!',
        description: variables.submit
          ? 'Your project has been submitted for review'
          : 'Your progress has been saved',
      });
      queryClient.invalidateQueries({ queryKey: ['project'] });

      if (variables.submit) {
        navigate(`/hackathon/${hackathonId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ProjectFormData, submit: boolean = false) => {
    saveMutation.mutate({ data, submit });
  };

  if (projectLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-heading font-bold">
              {existingProject ? 'Edit Project' : 'Submit Your Project'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {hackathon?.title} - Share what you've built!
            </p>
          </motion.div>

          <form onSubmit={handleSubmit((data) => onSubmit(data, false))}>
            <div className="space-y-8">
              {/* Basic Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-8"
              >
                <h2 className="text-xl font-heading font-semibold mb-6">Project Details</h2>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter your project name"
                      {...register('title')}
                      className="bg-muted/50 border-border"
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive">{errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your project, the problem it solves, and how it works..."
                      {...register('description')}
                      className="bg-muted/50 border-border resize-none"
                      rows={6}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">{errors.description.message}</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-8"
              >
                <h2 className="text-xl font-heading font-semibold mb-6">Links</h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="repo_url">GitHub Repository</Label>
                    <div className="relative">
                      <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="repo_url"
                        placeholder="https://github.com/username/repo"
                        {...register('repo_url')}
                        className="pl-10 bg-muted/50 border-border"
                      />
                    </div>
                    {errors.repo_url && (
                      <p className="text-sm text-destructive">{errors.repo_url.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="demo_url">Live Demo URL</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="demo_url"
                        placeholder="https://your-project.vercel.app"
                        {...register('demo_url')}
                        className="pl-10 bg-muted/50 border-border"
                      />
                    </div>
                    {errors.demo_url && (
                      <p className="text-sm text-destructive">{errors.demo_url.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video_url">Demo Video URL</Label>
                    <div className="relative">
                      <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="video_url"
                        placeholder="https://youtube.com/watch?v=..."
                        {...register('video_url')}
                        className="pl-10 bg-muted/50 border-border"
                      />
                    </div>
                    {errors.video_url && (
                      <p className="text-sm text-destructive">{errors.video_url.message}</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Tech Stack */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-8"
              >
                <h2 className="text-xl font-heading font-semibold mb-6">Tech Stack</h2>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newTech}
                      onChange={(e) => setNewTech(e.target.value)}
                      placeholder="Add a technology..."
                      className="bg-muted/50 border-border"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())}
                    />
                    <Button type="button" onClick={addTech} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {techStack.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {techStack.map((tech) => (
                        <Badge
                          key={tech}
                          className="bg-primary/20 text-primary border border-primary/30 cursor-pointer"
                          onClick={() => removeTech(tech)}
                        >
                          {tech}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Suggested:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_TECH.filter((t) => !techStack.includes(t))
                        .slice(0, 8)
                        .map((tech) => (
                          <Badge
                            key={tech}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10"
                            onClick={() => setTechStack([...techStack, tech])}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {tech}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Screenshots */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-8"
              >
                <h2 className="text-xl font-heading font-semibold mb-6">Screenshots</h2>

                <div className="space-y-4">
                  {screenshots.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {screenshots.map((url, index) => (
                        <div key={index} className="relative group aspect-video">
                          <img
                            src={url}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeScreenshot(index)}
                            className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {screenshots.length < 5 && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                      ) : (
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      )}
                      <p className="text-muted-foreground">
                        {isUploading ? 'Uploading...' : 'Click to upload screenshots'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        PNG, JPG up to 5MB ({screenshots.length}/5)
                      </p>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleScreenshotUpload}
                    className="hidden"
                  />
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-between"
              >
                <Button
                  type="submit"
                  variant="outline"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Draft
                </Button>

                <Button
                  type="button"
                  onClick={handleSubmit((data) => onSubmit(data, true))}
                  disabled={saveMutation.isPending}
                  className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Submit Project
                </Button>
              </motion.div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
