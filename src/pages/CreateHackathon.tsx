import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Trophy,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { BannerSelector } from '@/components/hackathon/BannerSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const hackathonSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  tagline: z.string().optional(),
  description: z.string().optional(),
  mode: z.enum(['online', 'offline', 'hybrid']),
  location: z.string().optional(),
  rules: z.string().optional(),
  min_team_size: z.number().min(1).max(10),
  max_team_size: z.number().min(1).max(10),
});

type HackathonFormData = z.infer<typeof hackathonSchema>;

interface Prize {
  id?: string;
  title: string;
  amount: number;
  description: string;
  position: number;
}

const steps = [
  { id: 1, title: 'Basic Info', icon: FileText },
  { id: 2, title: 'Dates & Location', icon: Calendar },
  { id: 3, title: 'Team Settings', icon: Users },
  { id: 4, title: 'Prizes', icon: Trophy },
];

export default function CreateHackathon() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [applicationDeadline, setApplicationDeadline] = useState<Date>();
  const [bannerUrl, setBannerUrl] = useState<string>(
    'https://static.vecteezy.com/system/resources/thumbnails/069/192/964/small/modern-abstract-purple-wave-on-dark-background-tech-banner-corporate-business-concept-hi-tech-abstract-background-illustration-for-business-or-presentation-vector.jpg'
  );
  const [prizes, setPrizes] = useState<Prize[]>([
    { title: '1st Place', amount: 1000, description: '', position: 1 },
    { title: '2nd Place', amount: 500, description: '', position: 2 },
    { title: '3rd Place', amount: 250, description: '', position: 3 },
  ]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HackathonFormData>({
    resolver: zodResolver(hackathonSchema),
    defaultValues: {
      mode: 'online',
      min_team_size: 1,
      max_team_size: 4,
    },
  });

  const mode = watch('mode');

  // Fetch existing hackathon if editing
  useQuery({
    queryKey: ['hackathon', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hackathons')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Populate form
      setValue('title', data.title);
      setValue('tagline', data.tagline || '');
      setValue('description', data.description || '');
      setValue('mode', data.mode);
      setValue('location', data.location || '');
      setValue('rules', data.rules || '');
      setValue('min_team_size', data.min_team_size);
      setValue('max_team_size', data.max_team_size);

      if (data.banner_url) setBannerUrl(data.banner_url);
      if (data.start_date) setStartDate(new Date(data.start_date));
      if (data.end_date) setEndDate(new Date(data.end_date));
      if (data.application_deadline) setApplicationDeadline(new Date(data.application_deadline));

      return data;
    },
    enabled: isEditing,
  });

  // Fetch prizes if editing
  useQuery({
    queryKey: ['hackathon-prizes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prizes')
        .select('*')
        .eq('hackathon_id', id)
        .order('position', { ascending: true });

      if (error) throw error;
      if (data.length > 0) {
        setPrizes(data);
      }
      return data;
    },
    enabled: isEditing,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: HackathonFormData) => {
      const hackathonData = {
        title: data.title,
        tagline: data.tagline || null,
        description: data.description || null,
        mode: data.mode,
        location: data.location || null,
        rules: data.rules || null,
        min_team_size: data.min_team_size,
        max_team_size: data.max_team_size,
        banner_url: bannerUrl || null,
        start_date: startDate?.toISOString().split('T')[0] || null,
        end_date: endDate?.toISOString().split('T')[0] || null,
        application_deadline: applicationDeadline?.toISOString().split('T')[0] || null,
        created_by: user!.id,
      };

      let hackathonId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('hackathons')
          .update(hackathonData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { data: newHackathon, error } = await supabase
          .from('hackathons')
          .insert(hackathonData)
          .select()
          .single();

        if (error) throw error;
        hackathonId = newHackathon.id;
      }

      // Handle prizes
      if (isEditing) {
        // Delete existing prizes
        await supabase.from('prizes').delete().eq('hackathon_id', hackathonId);
      }

      // Insert prizes
      const prizesToInsert = prizes.map((prize) => ({
        hackathon_id: hackathonId,
        title: prize.title,
        amount: prize.amount,
        description: prize.description,
        position: prize.position,
      }));

      if (prizesToInsert.length > 0) {
        const { error: prizeError } = await supabase.from('prizes').insert(prizesToInsert);
        if (prizeError) throw prizeError;
      }

      return hackathonId;
    },
    onSuccess: (hackathonId) => {
      toast({
        title: isEditing ? 'Hackathon updated!' : 'Hackathon created!',
        description: isEditing
          ? 'Your changes have been saved.'
          : 'Your hackathon has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['hackathons'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-hackathons'] });
      navigate(`/organizer/${hackathonId}`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      console.error(error);
    },
  });

  const addPrize = () => {
    setPrizes([
      ...prizes,
      {
        title: `${prizes.length + 1}${getOrdinalSuffix(prizes.length + 1)} Place`,
        amount: 0,
        description: '',
        position: prizes.length + 1,
      },
    ]);
  };

  const removePrize = (index: number) => {
    setPrizes(prizes.filter((_, i) => i !== index));
  };

  const updatePrize = (index: number, field: keyof Prize, value: string | number) => {
    const newPrizes = [...prizes];
    newPrizes[index] = { ...newPrizes[index], [field]: value };
    setPrizes(newPrizes);
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const onSubmit = (data: HackathonFormData) => {
    saveMutation.mutate(data);
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

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
              {isEditing ? 'Edit Hackathon' : 'Create a New Hackathon'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isEditing
                ? 'Update your hackathon details'
                : 'Set up your hackathon in a few simple steps'}
            </p>
          </motion.div>

          {/* Progress Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary/20 text-primary'
                          : isCompleted
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center',
                          isActive
                            ? 'bg-gradient-primary text-primary-foreground'
                            : isCompleted
                            ? 'bg-primary/20'
                            : 'bg-muted'
                        )}
                      >
                        <StepIcon className="w-4 h-4" />
                      </div>
                      <span className="hidden md:inline font-medium">{step.title}</span>
                    </button>
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          'w-8 md:w-16 h-0.5 mx-2',
                          isCompleted ? 'bg-primary' : 'bg-border'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="glass-card p-8">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Hackathon Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., AI Innovation Challenge 2024"
                      {...register('title')}
                      className="bg-muted/50 border-border"
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive">{errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input
                      id="tagline"
                      placeholder="A short, catchy description"
                      {...register('tagline')}
                      className="bg-muted/50 border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your hackathon, its goals, and what participants can expect..."
                      rows={6}
                      {...register('description')}
                      className="bg-muted/50 border-border resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rules">Rules & Guidelines</Label>
                    <Textarea
                      id="rules"
                      placeholder="Add any rules, eligibility criteria, or guidelines..."
                      rows={4}
                      {...register('rules')}
                      className="bg-muted/50 border-border resize-none"
                    />
                  </div>

                  <BannerSelector value={bannerUrl} onChange={setBannerUrl} />
                </div>
              )}

              {/* Step 2: Dates & Location */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Mode *</Label>
                    <Select
                      value={mode}
                      onValueChange={(value: 'online' | 'offline' | 'hybrid') =>
                        setValue('mode', value)
                      }
                    >
                      <SelectTrigger className="bg-muted/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border">
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">In-Person</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(mode === 'offline' || mode === 'hybrid') && (
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="location"
                          placeholder="e.g., San Francisco, CA"
                          {...register('location')}
                          className="pl-10 bg-muted/50 border-border"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal bg-muted/50 border-border',
                              !startDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 glass-card border-border" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal bg-muted/50 border-border',
                              !endDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 glass-card border-border" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Application Deadline</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal bg-muted/50 border-border',
                            !applicationDeadline && 'text-muted-foreground'
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {applicationDeadline
                            ? format(applicationDeadline, 'PPP')
                            : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 glass-card border-border" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={applicationDeadline}
                          onSelect={setApplicationDeadline}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* Step 3: Team Settings */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="min_team_size">Minimum Team Size</Label>
                      <Input
                        id="min_team_size"
                        type="number"
                        min={1}
                        max={10}
                        {...register('min_team_size', { valueAsNumber: true })}
                        className="bg-muted/50 border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_team_size">Maximum Team Size</Label>
                      <Input
                        id="max_team_size"
                        type="number"
                        min={1}
                        max={10}
                        {...register('max_team_size', { valueAsNumber: true })}
                        className="bg-muted/50 border-border"
                      />
                    </div>
                  </div>

                  <div className="glass-card p-6 bg-muted/30">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-primary" />
                      <span className="font-medium">Team Settings Preview</span>
                    </div>
                    <p className="text-muted-foreground">
                      Teams can have between {watch('min_team_size')} and {watch('max_team_size')}{' '}
                      members
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Prizes */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-heading font-semibold">Prize Pool</h3>
                      <p className="text-sm text-muted-foreground">
                        Add prizes to motivate participants
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addPrize}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Prize
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {prizes.map((prize, index) => (
                      <div key={index} className="glass-card p-6 bg-muted/30">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                              <Trophy className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <span className="font-medium">Position #{index + 1}</span>
                          </div>
                          {prizes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePrize(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              value={prize.title}
                              onChange={(e) => updatePrize(index, 'title', e.target.value)}
                              placeholder="e.g., 1st Place"
                              className="bg-muted/50 border-border"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Amount ($)</Label>
                            <Input
                              type="number"
                              value={prize.amount}
                              onChange={(e) =>
                                updatePrize(index, 'amount', parseInt(e.target.value) || 0)
                              }
                              placeholder="1000"
                              className="bg-muted/50 border-border"
                            />
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={prize.description}
                            onChange={(e) => updatePrize(index, 'description', e.target.value)}
                            placeholder="Prize description..."
                            className="bg-muted/50 border-border"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="glass-card p-6 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-heading font-semibold">Total Prize Pool</span>
                      <span className="text-2xl font-heading font-bold gradient-text">
                        ${prizes.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                {currentStep < steps.length ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : isEditing ? (
                      'Update Hackathon'
                    ) : (
                      'Create Hackathon'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </motion.form>
        </div>
      </div>
    </Layout>
  );
}
