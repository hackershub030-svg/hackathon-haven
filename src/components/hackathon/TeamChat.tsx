import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TeamChatProps {
  teamId: string;
}

interface Message {
  id: string;
  team_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function TeamChat({ teamId }: TeamChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');

  const { data: messages, isLoading } = useQuery({
    queryKey: ['team-messages', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for all unique user IDs
      const userIds = [...new Set(data.map((m) => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((msg) => ({
        ...msg,
        profile: profileMap.get(msg.user_id),
      })) as Message[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`team-messages-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `team_id=eq.${teamId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;

          // Fetch profile for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', newMsg.user_id)
            .maybeSingle();

          const messageWithProfile = { ...newMsg, profile };

          queryClient.setQueryData<Message[]>(['team-messages', teamId], (old) => {
            if (!old) return [messageWithProfile];
            // Avoid duplicates
            if (old.some((m) => m.id === messageWithProfile.id)) return old;
            return [...old, messageWithProfile];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase.from('team_messages').insert({
        team_id: teamId,
        user_id: user!.id,
        message,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card flex flex-col h-[600px]"
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-semibold">Team Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((msg) => {
              const isOwn = msg.user_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={msg.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-xs">
                      {msg.profile?.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {msg.profile?.full_name || 'User'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <div
                      className={`inline-block px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-gradient-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-4" />
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="bg-muted/50 border-border"
            disabled={sendMutation.isPending}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sendMutation.isPending}
            className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
