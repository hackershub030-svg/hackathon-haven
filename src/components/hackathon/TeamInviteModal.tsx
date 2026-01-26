import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
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
import {
  Copy,
  Check,
  Share2,
  Loader2,
  QrCode,
  RefreshCw,
  MessageCircle,
  Send,
} from 'lucide-react';

interface TeamInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  hackathonId: string;
  teamName: string;
  maxTeamSize?: number;
  currentMemberCount?: number;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function TeamInviteModal({
  open,
  onOpenChange,
  teamId,
  hackathonId,
  teamName,
  maxTeamSize = 4,
  currentMemberCount = 1,
}: TeamInviteModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Fetch existing active invite code
  const { data: existingCode, isLoading: isLoadingCode } = useQuery({
    queryKey: ['team-invite-code', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_invite_codes')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!teamId,
  });

  // Generate new invite code
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Invalidate existing codes first
      if (existingCode) {
        await supabase
          .from('team_invite_codes')
          .update({ status: 'expired' })
          .eq('id', existingCode.id);
      }

      const code = generateInviteCode();
      const { data, error } = await supabase
        .from('team_invite_codes')
        .insert({
          team_id: teamId,
          hackathon_id: hackathonId,
          code,
          created_by: user!.id,
          status: 'active',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invite-code', teamId] });
      toast({
        title: 'Invite code generated!',
        description: 'Share this code with your teammates.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to generate code',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const inviteCode = existingCode?.code || '';
  const inviteUrl = `${window.location.origin}/join-team?code=${inviteCode}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Invite code copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Failed to copy',
        variant: 'destructive',
      });
    }
  };

  const shareVia = (platform: 'whatsapp' | 'telegram' | 'sms') => {
    const message = encodeURIComponent(
      `Join my team "${teamName}" for the hackathon! Use code: ${inviteCode}\n\nOr join directly: ${inviteUrl}`
    );

    const urls = {
      whatsapp: `https://wa.me/?text=${message}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${message}`,
      sms: `sms:?body=${message}`,
    };

    window.open(urls[platform], '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Invite Team Members
          </DialogTitle>
          <DialogDescription>
            Share this code with teammates to join "{teamName}"
          </DialogDescription>
        </DialogHeader>

        {/* Team Size Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">Team capacity</span>
          <Badge variant={currentMemberCount >= maxTeamSize ? 'destructive' : 'secondary'}>
            {currentMemberCount} / {maxTeamSize} members
          </Badge>
        </div>

        <div className="space-y-6">
          {/* Generate Code Button or Display Code */}
          {isLoadingCode ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !inviteCode ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Generate an invite code to share with your teammates
              </p>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-gradient-primary"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Invite Code'
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Invite Code Display */}
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    value={inviteCode}
                    readOnly
                    className="text-center text-2xl font-mono tracking-widest h-14 pr-12"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => copyToClipboard(inviteCode)}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Regenerate Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New Code
                </Button>
              </div>

              {/* QR Code Toggle */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={() => setShowQR(!showQR)}
                  className="w-full"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {showQR ? 'Hide QR Code' : 'Show QR Code'}
                </Button>

                {showQR && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <QRCodeSVG
                      value={inviteUrl}
                      size={200}
                      level="H"
                      includeMargin
                    />
                  </div>
                )}
              </div>

              {/* Share Options */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Share via
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => shareVia('whatsapp')}
                    className="flex-col h-auto py-3"
                  >
                    <MessageCircle className="w-5 h-5 mb-1 text-green-500" />
                    <span className="text-xs">WhatsApp</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => shareVia('telegram')}
                    className="flex-col h-auto py-3"
                  >
                    <Send className="w-5 h-5 mb-1 text-blue-500" />
                    <span className="text-xs">Telegram</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => shareVia('sms')}
                    className="flex-col h-auto py-3"
                  >
                    <MessageCircle className="w-5 h-5 mb-1" />
                    <span className="text-xs">SMS</span>
                  </Button>
                </div>
              </div>

              {/* Copy Link */}
              <Button
                variant="secondary"
                onClick={() => copyToClipboard(inviteUrl)}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Invite Link
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
