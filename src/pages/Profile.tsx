import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  User,
  MapPin,
  Calendar,
  Edit2,
  Save,
  X,
  Plus,
  Camera,
  Loader2,
  Trophy,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  location: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const SUGGESTED_SKILLS = [
  'React', 'TypeScript', 'JavaScript', 'Python', 'Node.js', 'Go', 'Rust',
  'Machine Learning', 'AI', 'Web3', 'Blockchain', 'UI/UX Design', 'Figma',
  'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB', 'GraphQL', 'REST API',
];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [skills, setSkills] = useState<string[]>(profile?.skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
    },
  });

  // Fetch hackathon history
  const { data: hackathonHistory } = useQuery({
    queryKey: ['hackathon-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          id,
          status,
          created_at,
          hackathon:hackathons(id, title, start_date, end_date, status),
          team:teams(id, team_name)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          username: data.username || null,
          bio: data.bio || null,
          location: data.location || null,
          skills,
        })
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Profile updated!', description: 'Your changes have been saved.' });
      refreshProfile();
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image under 5MB', variant: 'destructive' });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user!.id);

      if (updateError) throw updateError;

      toast({ title: 'Avatar updated!', description: 'Your profile picture has been changed.' });
      refreshProfile();
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const addSuggestedSkill = (skill: string) => {
    if (!skills.includes(skill)) {
      setSkills([...skills, skill]);
    }
  };

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setSkills(profile?.skills || []);
    reset({
      full_name: profile?.full_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
    });
  };

  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 mb-8"
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Avatar */}
              <div className="relative group">
                <Avatar className="w-32 h-32 border-4 border-primary/30">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-3xl">
                    {profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 rounded-full transition-opacity"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-heading font-bold">
                      {profile?.full_name || 'Anonymous Hacker'}
                    </h1>
                    {profile?.username && (
                      <p className="text-muted-foreground">@{profile.username}</p>
                    )}
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={cancelEdit}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmit(onSubmit)}
                        disabled={updateProfileMutation.isPending}
                        className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
                      >
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <form className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          {...register('full_name')}
                          className="bg-muted/50 border-border"
                        />
                        {errors.full_name && (
                          <p className="text-sm text-destructive">{errors.full_name.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          {...register('username')}
                          className="bg-muted/50 border-border"
                          placeholder="@username"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        {...register('bio')}
                        className="bg-muted/50 border-border resize-none"
                        rows={3}
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="location"
                          {...register('location')}
                          className="pl-10 bg-muted/50 border-border"
                          placeholder="San Francisco, CA"
                        />
                      </div>
                    </div>
                  </form>
                ) : (
                  <>
                    {profile?.bio && (
                      <p className="text-muted-foreground mb-4">{profile.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {profile?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {profile.location}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Skills Section */}
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-lg font-heading font-semibold mb-4">Skills</h3>
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add a skill..."
                      className="bg-muted/50 border-border"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    />
                    <Button type="button" onClick={addSkill} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <Badge
                          key={skill}
                          className="bg-primary/20 text-primary border border-primary/30 cursor-pointer"
                          onClick={() => removeSkill(skill)}
                        >
                          {skill}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Suggested skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_SKILLS.filter((s) => !skills.includes(s))
                        .slice(0, 10)
                        .map((skill) => (
                          <Badge
                            key={skill}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10"
                            onClick={() => addSuggestedSkill(skill)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {skill}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile?.skills && profile.skills.length > 0 ? (
                    profile.skills.map((skill) => (
                      <Badge
                        key={skill}
                        className="bg-primary/20 text-primary border border-primary/30"
                      >
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No skills added yet</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Hackathon History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-8"
          >
            <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              Hackathon History
            </h2>

            {hackathonHistory && hackathonHistory.length > 0 ? (
              <div className="space-y-4">
                {hackathonHistory.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{entry.hackathon?.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {entry.team && (
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {entry.team.team_name}
                            </span>
                          )}
                          {entry.hackathon?.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(entry.hackathon.start_date), 'MMM yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={
                          entry.status === 'accepted'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : entry.status === 'submitted'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : entry.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'status-draft'
                        }
                      >
                        {entry.status === 'accepted' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No hackathon history yet</p>
                <Button className="mt-4 bg-gradient-primary hover:opacity-90 text-primary-foreground" asChild>
                  <a href="/hackathons">Browse Hackathons</a>
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
