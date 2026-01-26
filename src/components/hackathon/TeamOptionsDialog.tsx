import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, Crown } from 'lucide-react';

interface TeamOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTeam: () => void;
  onJoinTeam: () => void;
  hackathonTitle: string;
}

export function TeamOptionsDialog({
  open,
  onOpenChange,
  onCreateTeam,
  onJoinTeam,
  hackathonTitle,
}: TeamOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Join {hackathonTitle}
          </DialogTitle>
          <DialogDescription>
            Choose how you want to participate in this hackathon
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Create Team Option */}
          <button
            onClick={onCreateTeam}
            className="p-6 rounded-xl border border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  Create a Team
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Start a new team and invite others to join. You'll be the team leader.
                </p>
              </div>
            </div>
          </button>

          {/* Join Team Option */}
          <button
            onClick={onJoinTeam}
            className="p-6 rounded-xl border border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <UserPlus className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  Join Using Code
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Have an invite code? Enter it to join an existing team.
                </p>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
