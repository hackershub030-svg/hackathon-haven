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
  Phone,
  GraduationCap,
  Globe,
  Linkedin,
  Github,
  Link,
  FileText,
  Upload,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CountrySelect } from '@/components/profile/CountrySelect';
import { ProfileCompleteness } from '@/components/profile/ProfileCompleteness';
import { GenderSelect } from '@/components/profile/GenderSelect';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional().or(z.literal('')),
  age: z.coerce.number().min(13, 'Must be at least 13').max(120, 'Invalid age').optional().or(z.literal('')),
  gender: z.string().optional(),
  phone_number: z.string().optional(),
  college: z.string().optional(),
  country: z.string().optional(),
  level_of_study: z.string().optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  github_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  portfolio_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const LEVEL_OF_STUDY_OPTIONS = [
  'High School',
  'Undergraduate',
  'Graduate',
  'PhD',
  'Bootcamp',
  'Self-taught',
  'Working Professional',
];

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
  const resumeInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [skills, setSkills] = useState<string[]>(profile?.skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [levelOfStudy, setLevelOfStudy] = useState(profile?.level_of_study || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [gender, setGender] = useState(profile?.gender || '');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      username: profile?.username || '',
      age: profile?.age || '',
      gender: profile?.gender || '',
      phone_number: profile?.phone_number || '',
      college: profile?.college || '',
      country: profile?.country || '',
      level_of_study: profile?.level_of_study || '',
      bio: profile?.bio || '',
      linkedin_url: profile?.linkedin_url || '',
      github_url: profile?.github_url || '',
      portfolio_url: profile?.portfolio_url || '',
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
      // Check if username is taken (if provided and different from current)
      if (data.username && data.username !== profile?.username) {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', data.username)
          .neq('user_id', user!.id)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existingUser) {
          throw new Error('This username is already taken. Please choose another one.');
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          full_name: `${data.first_name} ${data.last_name}`.trim(),
          username: data.username || null,
          age: data.age || null,
          gender: gender || null,
          phone_number: data.phone_number || null,
          college: data.college || null,
          country: country || null,
          level_of_study: data.level_of_study || null,
          bio: data.bio || null,
          linkedin_url: data.linkedin_url || null,
          github_url: data.github_url || null,
          portfolio_url: data.portfolio_url || null,
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
      const message = error.message || 'Something went wrong';
      toast({
        title: 'Update failed',
        description: message.includes('username') ? message : 'Failed to update profile. Please try again.',
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

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Please upload a PDF file', variant: 'destructive' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload a PDF under 10MB', variant: 'destructive' });
      return;
    }

    setIsUploadingResume(true);

    try {
      const fileName = `${user!.id}/resume.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL for private bucket
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('resumes')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (signedUrlError) throw signedUrlError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ resume_url: signedUrlData.signedUrl })
        .eq('user_id', user!.id);

      if (updateError) throw updateError;

      toast({ title: 'Resume uploaded!', description: 'Your resume has been saved.' });
      refreshProfile();
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingResume(false);
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
    setLevelOfStudy(profile?.level_of_study || '');
    setCountry(profile?.country || '');
    setGender(profile?.gender || '');
    reset({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      username: profile?.username || '',
      age: profile?.age || '',
      gender: profile?.gender || '',
      phone_number: profile?.phone_number || '',
      college: profile?.college || '',
      country: profile?.country || '',
      level_of_study: profile?.level_of_study || '',
      bio: profile?.bio || '',
      linkedin_url: profile?.linkedin_url || '',
      github_url: profile?.github_url || '',
      portfolio_url: profile?.portfolio_url || '',
    });
  };

  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}` 
    : profile?.full_name || 'Anonymous Hacker';

  return (
    <Layout>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Profile Completeness Indicator */}
          <ProfileCompleteness profile={profile} />
          
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
                    {profile?.first_name?.[0] || profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
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
              <div className="flex-1 w-full">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-heading font-bold">{displayName}</h1>
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
                  <form className="space-y-6">
                    {/* Personal Information */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Personal Information
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first_name">First Name *</Label>
                          <Input
                            id="first_name"
                            {...register('first_name')}
                            className="bg-muted/50 border-border"
                          />
                          {errors.first_name && (
                            <p className="text-sm text-destructive">{errors.first_name.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last_name">Last Name *</Label>
                          <Input
                            id="last_name"
                            {...register('last_name')}
                            className="bg-muted/50 border-border"
                          />
                          {errors.last_name && (
                            <p className="text-sm text-destructive">{errors.last_name.message}</p>
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
                        <div className="space-y-2">
                          <Label htmlFor="age">Age</Label>
                          <Input
                            id="age"
                            type="number"
                            {...register('age')}
                            className="bg-muted/50 border-border"
                            placeholder="18"
                          />
                          {errors.age && (
                            <p className="text-sm text-destructive">{errors.age.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Gender</Label>
                          <GenderSelect
                            value={gender}
                            onValueChange={(value) => {
                              setGender(value);
                              setValue('gender', value);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone_number">Phone Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="phone_number"
                              {...register('phone_number')}
                              className="pl-10 bg-muted/50 border-border"
                              placeholder="+1 (555) 000-0000"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="college">College/University</Label>
                          <div className="relative">
                            <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="college"
                              {...register('college')}
                              className="pl-10 bg-muted/50 border-border"
                              placeholder="MIT"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="country">Country of Residence</Label>
                          <CountrySelect
                            value={country}
                            onValueChange={(value) => {
                              setCountry(value);
                              setValue('country', value);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="level_of_study">Level of Study</Label>
                          <Select
                            value={levelOfStudy}
                            onValueChange={(value) => {
                              setLevelOfStudy(value);
                              setValue('level_of_study', value);
                            }}
                          >
                            <SelectTrigger className="bg-muted/50 border-border">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              {LEVEL_OF_STUDY_OPTIONS.map((level) => (
                                <SelectItem key={level} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
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

                    {/* Social Links */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Link className="w-5 h-5 text-primary" />
                        Social Links
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="linkedin_url">LinkedIn</Label>
                          <div className="relative">
                            <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="linkedin_url"
                              {...register('linkedin_url')}
                              className="pl-10 bg-muted/50 border-border"
                              placeholder="https://linkedin.com/in/username"
                            />
                          </div>
                          {errors.linkedin_url && (
                            <p className="text-sm text-destructive">{errors.linkedin_url.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="github_url">GitHub</Label>
                          <div className="relative">
                            <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="github_url"
                              {...register('github_url')}
                              className="pl-10 bg-muted/50 border-border"
                              placeholder="https://github.com/username"
                            />
                          </div>
                          {errors.github_url && (
                            <p className="text-sm text-destructive">{errors.github_url.message}</p>
                          )}
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="portfolio_url">Portfolio</Label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="portfolio_url"
                              {...register('portfolio_url')}
                              className="pl-10 bg-muted/50 border-border"
                              placeholder="https://your-portfolio.com"
                            />
                          </div>
                          {errors.portfolio_url && (
                            <p className="text-sm text-destructive">{errors.portfolio_url.message}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Resume Upload */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Resume
                      </h3>
                      <div className="flex items-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => resumeInputRef.current?.click()}
                          disabled={isUploadingResume}
                        >
                          {isUploadingResume ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          Upload Resume (PDF)
                        </Button>
                        {profile?.resume_url && (
                          <a
                            href={profile.resume_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-4 h-4" />
                            View Current Resume
                          </a>
                        )}
                        <input
                          ref={resumeInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handleResumeUpload}
                          className="hidden"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Max file size: 10MB. Accepted format: PDF
                      </p>
                    </div>
                  </form>
                ) : (
                  <>
                    {profile?.bio && (
                      <p className="text-muted-foreground mb-4">{profile.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                      {user?.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </span>
                      )}
                      {profile?.phone_number && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {profile.phone_number}
                        </span>
                      )}
                      {profile?.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-4 h-4" />
                          {profile.country}
                        </span>
                      )}
                      {profile?.college && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-4 h-4" />
                          {profile.college}
                        </span>
                      )}
                      {profile?.level_of_study && (
                        <Badge variant="outline">{profile.level_of_study}</Badge>
                      )}
                      {profile?.age && (
                        <span className="flex items-center gap-1">
                          {profile.age} years old
                        </span>
                      )}
                    </div>
                    
                    {/* Social Links Display */}
                    <div className="flex flex-wrap gap-3">
                      {profile?.linkedin_url && (
                        <a
                          href={profile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Linkedin className="w-4 h-4" />
                          LinkedIn
                        </a>
                      )}
                      {profile?.github_url && (
                        <a
                          href={profile.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Github className="w-4 h-4" />
                          GitHub
                        </a>
                      )}
                      {profile?.portfolio_url && (
                        <a
                          href={profile.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          Portfolio
                        </a>
                      )}
                      {profile?.resume_url && (
                        <a
                          href={profile.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          Resume
                        </a>
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
