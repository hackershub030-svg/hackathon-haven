export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          application_data: Json | null
          created_at: string | null
          hackathon_id: string
          id: string
          status: Database["public"]["Enums"]["application_status"] | null
          submitted_at: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          application_data?: Json | null
          created_at?: string | null
          hackathon_id: string
          id?: string
          status?: Database["public"]["Enums"]["application_status"] | null
          submitted_at?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          application_data?: Json | null
          created_at?: string | null
          hackathon_id?: string
          id?: string
          status?: Database["public"]["Enums"]["application_status"] | null
          submitted_at?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          created_at: string | null
          hackathon_id: string
          id: string
          status: Database["public"]["Enums"]["claim_status"] | null
          type: Database["public"]["Enums"]["claim_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hackathon_id: string
          id?: string
          status?: Database["public"]["Enums"]["claim_status"] | null
          type: Database["public"]["Enums"]["claim_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          hackathon_id?: string
          id?: string
          status?: Database["public"]["Enums"]["claim_status"] | null
          type?: Database["public"]["Enums"]["claim_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathons: {
        Row: {
          application_deadline: string | null
          banner_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          max_team_size: number | null
          min_team_size: number | null
          mode: Database["public"]["Enums"]["hackathon_mode"] | null
          rules: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["hackathon_status"] | null
          tagline: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          application_deadline?: string | null
          banner_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          max_team_size?: number | null
          min_team_size?: number | null
          mode?: Database["public"]["Enums"]["hackathon_mode"] | null
          rules?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["hackathon_status"] | null
          tagline?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          application_deadline?: string | null
          banner_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          max_team_size?: number | null
          min_team_size?: number | null
          mode?: Database["public"]["Enums"]["hackathon_mode"] | null
          rules?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["hackathon_status"] | null
          tagline?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      judging_rubrics: {
        Row: {
          created_at: string | null
          description: string | null
          hackathon_id: string
          id: string
          max_score: number
          name: string
          sort_order: number
          weight: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hackathon_id: string
          id?: string
          max_score?: number
          name: string
          sort_order?: number
          weight?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hackathon_id?: string
          id?: string
          max_score?: number
          name?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "judging_rubrics_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      organizer_team: {
        Row: {
          accepted: boolean | null
          created_at: string | null
          email: string
          hackathon_id: string
          id: string
          role: Database["public"]["Enums"]["organizer_role"] | null
          user_id: string | null
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string | null
          email: string
          hackathon_id: string
          id?: string
          role?: Database["public"]["Enums"]["organizer_role"] | null
          user_id?: string | null
        }
        Update: {
          accepted?: boolean | null
          created_at?: string | null
          email?: string
          hackathon_id?: string
          id?: string
          role?: Database["public"]["Enums"]["organizer_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_team_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
        ]
      }
      prizes: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          hackathon_id: string
          id: string
          position: number | null
          title: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          hackathon_id: string
          id?: string
          position?: number | null
          title: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          hackathon_id?: string
          id?: string
          position?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "prizes_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_public: boolean | null
          location: string | null
          readme_md: string | null
          skills: string[] | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          readme_md?: string | null
          skills?: string[] | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          readme_md?: string | null
          skills?: string[] | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      project_scores: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          judge_id: string
          project_id: string
          rubric_id: string
          score: number
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          judge_id: string
          project_id: string
          rubric_id: string
          score: number
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          judge_id?: string
          project_id?: string
          rubric_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_scores_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_scores_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "judging_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          demo_url: string | null
          description: string | null
          hackathon_id: string
          id: string
          repo_url: string | null
          screenshots: string[] | null
          submitted: boolean | null
          team_id: string | null
          tech_stack: string[] | null
          title: string
          updated_at: string | null
          user_id: string | null
          video_url: string | null
          winner_position: number | null
        }
        Insert: {
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          hackathon_id: string
          id?: string
          repo_url?: string | null
          screenshots?: string[] | null
          submitted?: boolean | null
          team_id?: string | null
          tech_stack?: string[] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          winner_position?: number | null
        }
        Update: {
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          hackathon_id?: string
          id?: string
          repo_url?: string | null
          screenshots?: string[] | null
          submitted?: boolean | null
          team_id?: string | null
          tech_stack?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          winner_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          accepted: boolean | null
          created_at: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["team_role"] | null
          team_id: string
          user_id: string | null
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"] | null
          team_id: string
          user_id?: string | null
        }
        Update: {
          accepted?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"] | null
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          created_by: string | null
          hackathon_id: string
          id: string
          team_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          hackathon_id: string
          id?: string
          team_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          hackathon_id?: string
          id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hackathon_organizer: {
        Args: { _hackathon_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "organizer" | "admin"
      application_status:
        | "draft"
        | "submitted"
        | "accepted"
        | "rejected"
        | "waitlisted"
      claim_status: "pending" | "approved" | "rejected" | "paid"
      claim_type: "prize" | "bounty" | "certificate"
      hackathon_mode: "online" | "offline" | "hybrid"
      hackathon_status: "draft" | "live" | "ended"
      notification_type: "application" | "team_invite" | "hackathon" | "admin"
      organizer_role: "admin" | "reviewer" | "volunteer"
      team_role: "leader" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "organizer", "admin"],
      application_status: [
        "draft",
        "submitted",
        "accepted",
        "rejected",
        "waitlisted",
      ],
      claim_status: ["pending", "approved", "rejected", "paid"],
      claim_type: ["prize", "bounty", "certificate"],
      hackathon_mode: ["online", "offline", "hybrid"],
      hackathon_status: ["draft", "live", "ended"],
      notification_type: ["application", "team_invite", "hackathon", "admin"],
      organizer_role: ["admin", "reviewer", "volunteer"],
      team_role: ["leader", "member"],
    },
  },
} as const
