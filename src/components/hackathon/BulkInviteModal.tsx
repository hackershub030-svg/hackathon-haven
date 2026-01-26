import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users,
  Loader2,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface BulkInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  hackathonId: string;
  teamName: string;
  maxTeamSize: number;
  currentMemberCount: number;
}

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

export function BulkInviteModal({
  open,
  onOpenChange,
  teamId,
  hackathonId,
  teamName,
  maxTeamSize,
  currentMemberCount,
}: BulkInviteModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailsInput, setEmailsInput] = useState('');
  const [results, setResults] = useState<InviteResult[]>([]);

  const availableSlots = maxTeamSize - currentMemberCount;

  // Parse and validate emails
  const parseEmails = (input: string): string[] => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return input
      .split(/[,\n;]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && emailRegex.test(e))
      .filter((email, index, self) => self.indexOf(email) === index); // Remove duplicates
  };

  const parsedEmails = parseEmails(emailsInput);
  const excessEmails = parsedEmails.length > availableSlots;

  const bulkInviteMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const inviteResults: InviteResult[] = [];
      const emailsToInvite = emails.slice(0, availableSlots);

      for (const email of emailsToInvite) {
        try {
          // Check if already a member
          const { data: existingMember } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', teamId)
            .eq('email', email)
            .maybeSingle();

          if (existingMember) {
            inviteResults.push({
              email,
              success: false,
              error: 'Already a team member',
            });
            continue;
          }

          // Add as pending invite
          const { error } = await supabase.from('team_members').insert({
            team_id: teamId,
            email,
            role: 'member',
            accepted: false,
            join_status: 'invited',
          });

          if (error) {
            inviteResults.push({
              email,
              success: false,
              error: error.message,
            });
          } else {
            inviteResults.push({ email, success: true });
          }
        } catch (err: any) {
          inviteResults.push({
            email,
            success: false,
            error: err.message || 'Unknown error',
          });
        }
      }

      return inviteResults;
    },
    onSuccess: (results) => {
      setResults(results);
      const successCount = results.filter((r) => r.success).length;
      toast({
        title: `Invites sent`,
        description: `Successfully invited ${successCount} of ${results.length} members.`,
      });
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk invite failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleInvite = () => {
    if (parsedEmails.length === 0) {
      toast({
        title: 'No valid emails',
        description: 'Please enter valid email addresses.',
        variant: 'destructive',
      });
      return;
    }
    setResults([]);
    bulkInviteMutation.mutate(parsedEmails);
  };

  const resetModal = () => {
    setEmailsInput('');
    setResults([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetModal();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Bulk Invite Members
          </DialogTitle>
          <DialogDescription>
            Invite multiple team members at once to "{teamName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Capacity Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Available slots</span>
            <Badge variant={availableSlots > 0 ? 'secondary' : 'destructive'}>
              {availableSlots} of {maxTeamSize - 1} remaining
            </Badge>
          </div>

          {availableSlots === 0 ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span>Your team is full. Remove members to invite new ones.</span>
            </div>
          ) : (
            <>
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Email Addresses
                  <span className="text-muted-foreground ml-1">
                    (separate with commas, semicolons, or new lines)
                  </span>
                </label>
                <Textarea
                  value={emailsInput}
                  onChange={(e) => setEmailsInput(e.target.value)}
                  placeholder="john@example.com, jane@example.com&#10;mike@example.com"
                  className="min-h-[120px] font-mono text-sm"
                  disabled={bulkInviteMutation.isPending}
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {parsedEmails.length} valid email{parsedEmails.length !== 1 ? 's' : ''} detected
                  </span>
                  {excessEmails && (
                    <span className="text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Only first {availableSlots} will be invited
                    </span>
                  )}
                </div>
              </div>

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <h4 className="text-sm font-medium">Results</h4>
                  {results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        result.success
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {result.email}
                      </span>
                      {result.success ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs">{result.error}</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={parsedEmails.length === 0 || bulkInviteMutation.isPending}
                  className="flex-1"
                >
                  {bulkInviteMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Invite {Math.min(parsedEmails.length, availableSlots)} Member{parsedEmails.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
