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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string
          campaign_id: string
          creator_id: string
          id: string
          proposal: string
          requested_budget: number | null
          reviewed_at: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applied_at?: string
          campaign_id: string
          creator_id: string
          id?: string
          proposal: string
          requested_budget?: number | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applied_at?: string
          campaign_id?: string
          creator_id?: string
          id?: string
          proposal?: string
          requested_budget?: number | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          campaign_goals: string | null
          created_at: string
          deadline: string | null
          deliverables: string[] | null
          description: string
          id: string
          requirements: string | null
          sponsor_id: string
          status: Database["public"]["Enums"]["campaign_status"]
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          campaign_goals?: string | null
          created_at?: string
          deadline?: string | null
          deliverables?: string[] | null
          description: string
          id?: string
          requirements?: string | null
          sponsor_id: string
          status?: Database["public"]["Enums"]["campaign_status"]
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          campaign_goals?: string | null
          created_at?: string
          deadline?: string | null
          deliverables?: string[] | null
          description?: string
          id?: string
          requirements?: string | null
          sponsor_id?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborations: {
        Row: {
          agreed_budget: number
          application_id: string | null
          campaign_id: string
          contract_terms: string | null
          created_at: string
          creator_id: string
          deadline: string
          deliverables: string[]
          id: string
          sponsor_id: string
          status: Database["public"]["Enums"]["collaboration_status"]
          updated_at: string
        }
        Insert: {
          agreed_budget: number
          application_id?: string | null
          campaign_id: string
          contract_terms?: string | null
          created_at?: string
          creator_id: string
          deadline: string
          deliverables: string[]
          id?: string
          sponsor_id: string
          status?: Database["public"]["Enums"]["collaboration_status"]
          updated_at?: string
        }
        Update: {
          agreed_budget?: number
          application_id?: string | null
          campaign_id?: string
          contract_terms?: string | null
          created_at?: string
          creator_id?: string
          deadline?: string
          deliverables?: string[]
          id?: string
          sponsor_id?: string
          status?: Database["public"]["Enums"]["collaboration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborations_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          collaboration_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          content_url: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          metrics: Json | null
          platform: string | null
          reviewed_at: string | null
          reviewer_feedback: string | null
          status: Database["public"]["Enums"]["content_status"]
          submitted_at: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          collaboration_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          metrics?: Json | null
          platform?: string | null
          reviewed_at?: string | null
          reviewer_feedback?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          submitted_at?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          collaboration_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          metrics?: Json | null
          platform?: string | null
          reviewed_at?: string | null
          reviewer_feedback?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          submitted_at?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaborations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_type: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_type?: string | null
        }
        Relationships: []
      }
      secure_social_tokens: {
        Row: {
          account_id: string
          created_at: string | null
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          id: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secure_social_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "social_media_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_accounts: {
        Row: {
          connected_at: string
          created_at: string
          creator_id: string
          display_name: string | null
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          platform: string
          platform_user_id: string
          profile_image_url: string | null
          token_expires_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          connected_at?: string
          created_at?: string
          creator_id: string
          display_name?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform: string
          platform_user_id: string
          profile_image_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          connected_at?: string
          created_at?: string
          creator_id?: string
          display_name?: string | null
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          platform?: string
          platform_user_id?: string
          profile_image_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_stats: {
        Row: {
          account_id: string
          avg_comments_per_post: number | null
          avg_likes_per_post: number | null
          created_at: string
          engagement_rate: number | null
          followers_count: number | null
          following_count: number | null
          id: string
          likes_count: number | null
          posts_count: number | null
          recorded_at: string
          views_count: number | null
        }
        Insert: {
          account_id: string
          avg_comments_per_post?: number | null
          avg_likes_per_post?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          posts_count?: number | null
          recorded_at?: string
          views_count?: number | null
        }
        Update: {
          account_id?: string
          avg_comments_per_post?: number | null
          avg_likes_per_post?: number | null
          created_at?: string
          engagement_rate?: number | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          posts_count?: number | null
          recorded_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_stats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_media_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      token_access_audit: {
        Row: {
          access_type: string
          accessed_at: string | null
          account_id: string | null
          function_name: string | null
          id: string
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string | null
          account_id?: string | null
          function_name?: string | null
          id?: string
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string | null
          account_id?: string | null
          function_name?: string | null
          id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_access_audit_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_media_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_token: {
        Args: { encrypted_token: string }
        Returns: string
      }
      encrypt_token: {
        Args: { token: string }
        Returns: string
      }
      get_decrypted_tokens: {
        Args: { account_id: string }
        Returns: {
          access_token: string
          refresh_token: string
        }[]
      }
      get_safe_social_media_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          connected_at: string
          created_at: string
          creator_id: string
          display_name: string
          id: string
          is_active: boolean
          last_synced_at: string
          platform: string
          platform_user_id: string
          profile_image_url: string
          token_expires_at: string
          updated_at: string
          username: string
        }[]
      }
      get_secure_social_tokens: {
        Args: { account_id: string }
        Returns: {
          access_token: string
          expires_at: string
          refresh_token: string
        }[]
      }
      get_social_account_with_tokens: {
        Args: { account_id: string }
        Returns: {
          connected_at: string
          created_at: string
          creator_id: string
          display_name: string
          encrypted_access_token: string
          encrypted_refresh_token: string
          id: string
          is_active: boolean
          last_synced_at: string
          platform: string
          platform_user_id: string
          profile_image_url: string
          token_expires_at: string
          updated_at: string
          username: string
        }[]
      }
      secure_token_validation: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      secure_update_social_tokens: {
        Args: {
          account_id: string
          new_access_token?: string
          new_expires_at?: string
          new_refresh_token?: string
        }
        Returns: boolean
      }
      security_compliance_check: {
        Args: Record<PropertyKey, never>
        Returns: {
          issue_type: string
          object_name: string
          recommendation: string
          schema_name: string
        }[]
      }
      social_media_accounts_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          connected_at: string
          created_at: string
          creator_id: string
          display_name: string
          id: string
          is_active: boolean
          last_synced_at: string
          platform: string
          platform_user_id: string
          profile_image_url: string
          token_expires_at: string
          updated_at: string
          username: string
        }[]
      }
      update_encrypted_tokens: {
        Args: {
          account_id: string
          new_access_token?: string
          new_refresh_token?: string
        }
        Returns: undefined
      }
      update_secure_social_tokens: {
        Args: {
          account_id: string
          new_access_token?: string
          new_expires_at?: string
          new_refresh_token?: string
        }
        Returns: undefined
      }
      validate_rls_security: {
        Args: Record<PropertyKey, never>
        Returns: {
          has_anon_block: boolean
          has_rls: boolean
          status: string
          table_name: string
        }[]
      }
    }
    Enums: {
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      campaign_status: "draft" | "active" | "paused" | "completed" | "cancelled"
      collaboration_status: "active" | "completed" | "cancelled" | "disputed"
      content_status:
        | "pending"
        | "submitted"
        | "approved"
        | "rejected"
        | "revision_requested"
      content_type: "post" | "story" | "video" | "reel" | "blog" | "other"
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
      application_status: ["pending", "accepted", "rejected", "withdrawn"],
      campaign_status: ["draft", "active", "paused", "completed", "cancelled"],
      collaboration_status: ["active", "completed", "cancelled", "disputed"],
      content_status: [
        "pending",
        "submitted",
        "approved",
        "rejected",
        "revision_requested",
      ],
      content_type: ["post", "story", "video", "reel", "blog", "other"],
    },
  },
} as const
