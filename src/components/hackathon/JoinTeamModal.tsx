import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRateLimit } from '@/hooks/useRateLimit';
import {
  Users,
  Loader2,
  QrCode,
  UserPlus,
  CheckCircle2,
  XCircle,
  Crown,
  Camera,
  X,
  AlertTriangle,
} from 'lucide-react';

interface JoinTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathonId: string;
  initialCode?: string;
}

interface TeamInfo {
  id: string;
  team_name: string;
  hackathon_id: string;
  created_by: string;
  hackathon: {
    title: string;
    max_team_size: number;
  };
  leader: {
    full_name: string;
  };
  memberCount: number;
}

export function JoinTeamModal({
  open,
  onOpenChange,
  hackathonId,
  initialCode = '',
}: JoinTeamModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState(initialCode);
  const [isScanning, setIsScanning] = useState(false);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Rate limiting: 5 attempts per 60 seconds
  const { checkRateLimit, isRateLimited, remainingAttempts } = useRateLimit({
    maxAttempts: 5,
    windowMs: 60000,
  });

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      validateCode(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const validateCode = async (inviteCode: string) => {
    if (inviteCode.length !== 8) {
      setTeamInfo(null);
      return;
    }

    // Check rate limit before validating
    if (!checkRateLimit()) {
      toast({
        title: 'Too many attempts',
        description: 'Please wait a moment before trying again.',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    try {
      // Get invite code details
      const { data: inviteData, error: inviteError } = await supabase
        .from('team_invite_codes')
        .select('*')
        .eq('code', inviteCode.toUpperCase())
        .eq('status', 'active')
        .eq('hackathon_id', hackathonId)
        .maybeSingle();

      if (inviteError || !inviteData) {
        setTeamInfo(null);
        if (inviteCode.length === 8) {
          toast({
            title: 'Invalid code',
            description: 'This invite code is invalid or expired.',
            variant: 'destructive',
          });
        }
        return;
      }

      // Check if code has expired
      if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
        setTeamInfo(null);
        toast({
          title: 'Code expired',
          description: 'This invite code has expired.',
          variant: 'destructive',
        });
        return;
      }

      // Get team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', inviteData.team_id)
        .single();

      if (teamError || !teamData) {
        setTeamInfo(null);
        return;
      }

      // Get hackathon details
      const { data: hackathonData } = await supabase
        .from('hackathons')
        .select('title, max_team_size')
        .eq('id', hackathonId)
        .single();

      // Get leader profile
      const { data: leaderData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', teamData.created_by)
        .single();

      // Get member count
      const { count } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamData.id)
        .or('accepted.eq.true,join_status.eq.pending');

      setTeamInfo({
        id: teamData.id,
        team_name: teamData.team_name,
        hackathon_id: teamData.hackathon_id,
        created_by: teamData.created_by,
        hackathon: {
          title: hackathonData?.title || 'Unknown Hackathon',
          max_team_size: hackathonData?.max_team_size || 4,
        },
        leader: {
          full_name: leaderData?.full_name || 'Unknown',
        },
        memberCount: count || 1,
      });
    } catch (error) {
      console.error('Error validating code:', error);
      setTeamInfo(null);
    } finally {
      setIsValidating(false);
    }
  };

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsScanning(true);
      
      // Note: Full QR scanning would require a library like @zxing/browser
      // For now, we show the camera feed as a placeholder
      toast({
        title: 'Camera active',
        description: 'Point at a QR code. For best results, enter the code manually.',
      });
    } catch (error) {
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access or enter the code manually.',
        variant: 'destructive',
      });
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Join team mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!teamInfo || !user) throw new Error('Missing team or user info');

      // Check if user is already in a team for this hackathon
      const { data: existingMembership } = await supabase
        .from('team_members')
        .select(`
          *,
          team:teams!inner(hackathon_id)
        `)
        .eq('user_id', user.id)
        .eq('team.hackathon_id', hackathonId)
        .maybeSingle();

      if (existingMembership) {
        throw new Error('You are already in a team for this hackathon');
      }

      // Check if team is full
      if (teamInfo.memberCount >= teamInfo.hackathon.max_team_size) {
        throw new Error('This team is already full');
      }

      // Add user as pending member
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamInfo.id,
          user_id: user.id,
          email: user.email!,
          role: 'member',
          accepted: false,
          join_status: 'pending',
        });

      if (error) throw error;

      // Create notification for team leader
      await supabase.from('notifications').insert({
        user_id: teamInfo.created_by,
        type: 'team_invite',
        title: 'New Join Request',
        message: `Someone wants to join your team "${teamInfo.team_name}"`,
        metadata: {
          team_id: teamInfo.id,
          requester_id: user.id,
          hackathon_id: hackathonId,
        },
      });

      return teamInfo;
    },
    onSuccess: () => {
      toast({
        title: 'Request sent!',
        description: 'Waiting for team leader approval.',
      });
      queryClient.invalidateQueries({ queryKey: ['user-team-membership'] });
      queryClient.invalidateQueries({ queryKey: ['pending-join-requests'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to join',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCodeChange = (value: string) => {
    const upperValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(upperValue);
    if (upperValue.length === 8) {
      validateCode(upperValue);
    } else {
      setTeamInfo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Join a Team
          </DialogTitle>
          <DialogDescription>
            Enter an 8-digit invite code or scan a QR code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Rate Limit Warning */}
          {isRateLimited && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Too many attempts. Please wait before trying again.</span>
            </div>
          )}

          {/* Code Input */}
          {!isScanning && (
            <div className="space-y-4">
              <Input
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Enter invite code (e.g., A7K9Q2M8)"
                className="text-center text-xl font-mono tracking-widest h-14"
                maxLength={8}
                disabled={isRateLimited}
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={startScanning}
                  className="flex-1"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Scan QR Code
                </Button>
              </div>
            </div>
          )}

          {/* QR Scanner */}
          {isScanning && (
            <div className="space-y-4">
              <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <div className="absolute inset-0 border-2 border-primary/50 rounded-lg" />
              </div>
              <Button
                variant="outline"
                onClick={stopScanning}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Scanning
              </Button>
            </div>
          )}

          {/* Validation Loading */}
          {isValidating && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Validating code...</span>
            </div>
          )}

          {/* Team Info Display */}
          {teamInfo && !isValidating && (
            <div className="p-4 rounded-lg bg-muted/30 border border-primary/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-500">Valid Code</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Team</span>
                  <span className="font-medium">{teamInfo.team_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Hackathon</span>
                  <span className="font-medium">{teamInfo.hackathon.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Team Leader</span>
                  <span className="font-medium flex items-center gap-1">
                    <Crown className="w-3 h-3 text-yellow-400" />
                    {teamInfo.leader.full_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Team Size</span>
                  <Badge variant={
                    teamInfo.memberCount >= teamInfo.hackathon.max_team_size
                      ? 'destructive'
                      : 'secondary'
                  }>
                    {teamInfo.memberCount} / {teamInfo.hackathon.max_team_size}
                  </Badge>
                </div>
              </div>

              {teamInfo.memberCount >= teamInfo.hackathon.max_team_size ? (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm">This team is full</span>
                </div>
              ) : (
                <Button
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending}
                  className="w-full bg-gradient-primary"
                >
                  {joinMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 mr-2" />
                      Join Team
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
