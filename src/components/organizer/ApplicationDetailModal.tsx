import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  Mail,
  Phone,
  GraduationCap,
  MapPin,
  Crown,
  User,
  Presentation,
  Globe,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

interface ApplicationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
  onViewPresentation?: () => void;
}

export function ApplicationDetailModal({
  open,
  onOpenChange,
  application,
  onViewPresentation,
}: ApplicationDetailModalProps) {
  // Fetch team members with their profiles
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members-details', application?.team?.id],
    queryFn: async () => {
      if (!application?.team?.id) return [];

      // Fetch team members
      const { data: members, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', application.team.id)
        .order('role', { ascending: true });

      if (error) throw error;
      if (!members || members.length === 0) return [];

      // Fetch profiles for members with user_id
      const userIds = members.filter(m => m.user_id).map(m => m.user_id);
      
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, first_name, last_name, email, phone_number, college, country, gender, avatar_url')
          .in('user_id', userIds);
        
        profiles = profilesData || [];
      }

      // Merge members with profiles
      return members.map(member => {
        const profile = profiles.find(p => p.user_id === member.user_id);
        return {
          ...member,
          profile,
        };
      });
    },
    enabled: open && !!application?.team?.id,
  });

  if (!application) return null;

  const leader = teamMembers?.find(m => m.role === 'leader');
  const members = teamMembers?.filter(m => m.role === 'member') || [];
  const domain = application.application_data?.domain || 'Not specified';

  // Get college and state from leader profile
  const collegeInfo = leader?.profile?.college || 'Not specified';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Users className="w-6 h-6 text-primary" />
            {application.team?.team_name || 'Application Details'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Domain & College */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Domain</p>
                <p className="font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {domain}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">College</p>
                <p className="font-medium flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  {collegeInfo}
                </p>
              </div>
            </div>

            {/* Team Leader */}
            {leader && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold">Team Leader</h3>
                </div>
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12 border-2 border-primary/30">
                    <AvatarImage src={leader.profile?.avatar_url} />
                    <AvatarFallback className="bg-primary/20">
                      {leader.profile?.first_name?.[0] || leader.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 grid md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{leader.profile?.full_name || leader.profile?.first_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {leader.profile?.gender || 'Not specified'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{leader.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{leader.profile?.phone_number || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{leader.profile?.country || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Team Members */}
            {members.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Team Members
                </h3>
                <div className="space-y-3">
                  {members.map((member, index) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="w-10 h-10 border border-border">
                          <AvatarImage src={member.profile?.avatar_url} />
                          <AvatarFallback className="bg-muted">
                            {member.profile?.first_name?.[0] || member.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 grid md:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{member.profile?.full_name || `Member ${index + 1}`}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {member.profile?.gender || 'N/A'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{member.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>{member.profile?.phone_number || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Presentation */}
            {application.presentation_url && (
              <div className="p-4 rounded-lg bg-muted/30">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Presentation className="w-5 h-5 text-primary" />
                  Presentation
                </h3>
                <Button
                  variant="outline"
                  onClick={onViewPresentation}
                  className="gap-2"
                >
                  <Presentation className="w-4 h-4" />
                  View Presentation
                </Button>
              </div>
            )}

            {/* Application Details */}
            {(application.application_data?.project_idea || application.application_data?.why_join) && (
              <div className="space-y-4">
                {application.application_data?.project_idea && (
                  <div>
                    <h4 className="font-medium text-muted-foreground mb-2">Project Idea</h4>
                    <p className="text-sm">{application.application_data.project_idea}</p>
                  </div>
                )}
                {application.application_data?.why_join && (
                  <div>
                    <h4 className="font-medium text-muted-foreground mb-2">Why Join</h4>
                    <p className="text-sm">{application.application_data.why_join}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
