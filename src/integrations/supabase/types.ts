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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_activity: {
        Row: {
          application_id: string | null
          created_at: string
          detail: Json
          id: string
          policy: string | null
          status: string
          summary: string
          task_type: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          policy?: string | null
          status: string
          summary: string
          task_type: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          policy?: string | null
          status?: string
          summary?: string
          task_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          autonomy: string
          created_at: string
          enabled: boolean
          last_run_at: string | null
          min_fit_score: number
          updated_at: string
          user_id: string
          weekly_application_limit: number
        }
        Insert: {
          autonomy?: string
          created_at?: string
          enabled?: boolean
          last_run_at?: string | null
          min_fit_score?: number
          updated_at?: string
          user_id: string
          weekly_application_limit?: number
        }
        Update: {
          autonomy?: string
          created_at?: string
          enabled?: boolean
          last_run_at?: string | null
          min_fit_score?: number
          updated_at?: string
          user_id?: string
          weekly_application_limit?: number
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      application_events: {
        Row: {
          application_id: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          job_id: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          job_id?: string | null
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          job_id?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string | null
          created_at: string
          fit_score: number
          id: string
          job_id: string
          last_email_status: string | null
          next_action: string | null
          notes: string | null
          status: string
          tailored_pack: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          fit_score?: number
          id?: string
          job_id: string
          last_email_status?: string | null
          next_action?: string | null
          notes?: string | null
          status?: string
          tailored_pack?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          fit_score?: number
          id?: string
          job_id?: string
          last_email_status?: string | null
          next_action?: string | null
          notes?: string | null
          status?: string
          tailored_pack?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          created_at: string
          cursor: Json
          job_key: string
          job_type: string
          last_completed_at: string | null
          last_error: string | null
          last_started_at: string | null
          lease_expires_at: string | null
          pause_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor?: Json
          job_key: string
          job_type: string
          last_completed_at?: string | null
          last_error?: string | null
          last_started_at?: string | null
          lease_expires_at?: string | null
          pause_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor?: Json
          job_key?: string
          job_type?: string
          last_completed_at?: string | null
          last_error?: string | null
          last_started_at?: string | null
          lease_expires_at?: string | null
          pause_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      discovery_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_summary: string | null
          id: string
          jobs_added: number
          jobs_found: number
          source: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: string
          jobs_added?: number
          jobs_found?: number
          source: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: string
          jobs_added?: number
          jobs_found?: number
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_sync_state: {
        Row: {
          created_at: string
          history_id: string | null
          last_error: string | null
          last_notification_at: string | null
          last_success_at: string | null
          lease_expires_at: string | null
          mailbox_email: string | null
          status: string
          updated_at: string
          user_id: string
          watch_expiration: string | null
        }
        Insert: {
          created_at?: string
          history_id?: string | null
          last_error?: string | null
          last_notification_at?: string | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          mailbox_email?: string | null
          status?: string
          updated_at?: string
          user_id: string
          watch_expiration?: string | null
        }
        Update: {
          created_at?: string
          history_id?: string | null
          last_error?: string | null
          last_notification_at?: string | null
          last_success_at?: string | null
          lease_expires_at?: string | null
          mailbox_email?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          watch_expiration?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          canonical_url: string | null
          company_name: string
          country: string
          description: string
          discovered_at: string
          domain: string
          external_reference: string | null
          extraction_provenance: Json
          id: string
          is_remote: boolean
          job_url: string
          lifecycle_status: string
          location: string
          min_years_exp: number
          preferred_skills: string[]
          required_skills: string[]
          salary_range: string | null
          source: string
          source_provider: string | null
          source_record_id: string | null
          title: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          canonical_url?: string | null
          company_name: string
          country?: string
          description?: string
          discovered_at?: string
          domain?: string
          external_reference?: string | null
          extraction_provenance?: Json
          id?: string
          is_remote?: boolean
          job_url?: string
          lifecycle_status?: string
          location?: string
          min_years_exp?: number
          preferred_skills?: string[]
          required_skills?: string[]
          salary_range?: string | null
          source?: string
          source_provider?: string | null
          source_record_id?: string | null
          title: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          canonical_url?: string | null
          company_name?: string
          country?: string
          description?: string
          discovered_at?: string
          domain?: string
          external_reference?: string | null
          extraction_provenance?: Json
          id?: string
          is_remote?: boolean
          job_url?: string
          lifecycle_status?: string
          location?: string
          min_years_exp?: number
          preferred_skills?: string[]
          required_skills?: string[]
          salary_range?: string | null
          source?: string
          source_provider?: string | null
          source_record_id?: string | null
          title?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      portal_tasks: {
        Row: {
          adapter: string
          application_id: string
          created_at: string
          error: string | null
          filled_fields: Json
          id: string
          lease_expires_at: string | null
          portal_url: string
          screenshot_path: string | null
          status: string
          stop_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adapter?: string
          application_id: string
          created_at?: string
          error?: string | null
          filled_fields?: Json
          id?: string
          lease_expires_at?: string | null
          portal_url: string
          screenshot_path?: string | null
          status?: string
          stop_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adapter?: string
          application_id?: string
          created_at?: string
          error?: string | null
          filled_fields?: Json
          id?: string
          lease_expires_at?: string | null
          portal_url?: string
          screenshot_path?: string | null
          status?: string
          stop_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_mail_messages: {
        Row: {
          action_summary: string | null
          application_id: string | null
          classification: string | null
          company_name: string | null
          confidence: number | null
          created_at: string
          id: string
          job_title: string | null
          match_reason: string | null
          matched: boolean
          processed_at: string
          provider: string
          provider_history_id: string | null
          provider_message_id: string
          received_at: string | null
          sender: string
          source_kind: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_summary?: string | null
          application_id?: string | null
          classification?: string | null
          company_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          job_title?: string | null
          match_reason?: string | null
          matched?: boolean
          processed_at?: string
          provider: string
          provider_history_id?: string | null
          provider_message_id: string
          received_at?: string | null
          sender?: string
          source_kind?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_summary?: string | null
          application_id?: string | null
          classification?: string | null
          company_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          job_title?: string | null
          match_reason?: string | null
          matched?: boolean
          processed_at?: string
          provider?: string
          provider_history_id?: string | null
          provider_message_id?: string
          received_at?: string | null
          sender?: string
          source_kind?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_mail_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          discovery_frequency: string
          excluded_employers: string[]
          excluded_keywords: string[]
          full_name: string
          headline: string
          id: string
          remote_preference: string
          requires_visa: boolean
          salary_floor: number | null
          target_domains: string[]
          target_locations: string[]
          target_titles: string[]
          updated_at: string
          years_experience: number
        }
        Insert: {
          created_at?: string
          discovery_frequency?: string
          excluded_employers?: string[]
          excluded_keywords?: string[]
          full_name?: string
          headline?: string
          id: string
          remote_preference?: string
          requires_visa?: boolean
          salary_floor?: number | null
          target_domains?: string[]
          target_locations?: string[]
          target_titles?: string[]
          updated_at?: string
          years_experience?: number
        }
        Update: {
          created_at?: string
          discovery_frequency?: string
          excluded_employers?: string[]
          excluded_keywords?: string[]
          full_name?: string
          headline?: string
          id?: string
          remote_preference?: string
          requires_visa?: boolean
          salary_floor?: number | null
          target_domains?: string[]
          target_locations?: string[]
          target_titles?: string[]
          updated_at?: string
          years_experience?: number
        }
        Relationships: []
      }
      role_decisions: {
        Row: {
          created_at: string
          decision: string
          id: string
          job_id: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          job_id: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          job_id?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_decisions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_connections: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_synced_at: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sponsor_import_rows: {
        Row: {
          county: string
          organisation_name: string
          organisation_normalized: string
          route: string
          snapshot_id: string
          town_city: string
          type_rating: string
        }
        Insert: {
          county?: string
          organisation_name: string
          organisation_normalized: string
          route?: string
          snapshot_id: string
          town_city?: string
          type_rating?: string
        }
        Update: {
          county?: string
          organisation_name?: string
          organisation_normalized?: string
          route?: string
          snapshot_id?: string
          town_city?: string
          type_rating?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_import_rows_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "sponsor_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_snapshots: {
        Row: {
          attachment_url: string
          checksum: string
          created_at: string
          error_summary: string | null
          id: string
          imported_at: string | null
          row_count: number
          source_updated_at: string | null
          source_url: string
          status: string
          updated_at: string
        }
        Insert: {
          attachment_url: string
          checksum: string
          created_at?: string
          error_summary?: string | null
          id?: string
          imported_at?: string | null
          row_count?: number
          source_updated_at?: string | null
          source_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string
          checksum?: string
          created_at?: string
          error_summary?: string | null
          id?: string
          imported_at?: string | null
          row_count?: number
          source_updated_at?: string | null
          source_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          county: string
          id: number
          organisation_name: string
          organisation_normalized: string
          route: string
          snapshot_id: string | null
          town_city: string
          type_rating: string
        }
        Insert: {
          county?: string
          id?: number
          organisation_name: string
          organisation_normalized: string
          route?: string
          snapshot_id?: string | null
          town_city?: string
          type_rating?: string
        }
        Update: {
          county?: string
          id?: number
          organisation_name?: string
          organisation_normalized?: string
          route?: string
          snapshot_id?: string | null
          town_city?: string
          type_rating?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "sponsor_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      unmatched_mail_messages: {
        Row: {
          action_summary: string | null
          classification: string | null
          company_name: string | null
          created_at: string
          id: string
          job_title: string | null
          linked_application_id: string | null
          match_reason: string | null
          provider: string
          provider_message_id: string
          received_at: string | null
          review_status: string
          sender: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_summary?: string | null
          classification?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          linked_application_id?: string | null
          match_reason?: string | null
          provider: string
          provider_message_id: string
          received_at?: string | null
          review_status?: string
          sender?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_summary?: string | null
          classification?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          linked_application_id?: string | null
          match_reason?: string | null
          provider?: string
          provider_message_id?: string
          received_at?: string | null
          review_status?: string
          sender?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_mail_messages_linked_application_id_fkey"
            columns: ["linked_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_items: {
        Row: {
          category: string
          created_at: string
          description: string
          end_date: string
          id: string
          is_current: boolean
          is_verified: boolean
          metrics: string[]
          organization: string
          skills: string[]
          start_date: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          is_current?: boolean
          is_verified?: boolean
          metrics?: string[]
          organization?: string
          skills?: string[]
          start_date?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          is_current?: boolean
          is_verified?: boolean
          metrics?: string[]
          organization?: string
          skills?: string[]
          start_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_sponsor_snapshot: {
        Args: { target_snapshot: string }
        Returns: number
      }
      claim_automation_job: {
        Args: {
          lease_seconds?: number
          target_key: string
          target_type: string
        }
        Returns: boolean
      }
      claim_portal_task: {
        Args: { lease_seconds?: number }
        Returns: {
          adapter: string
          application_id: string
          created_at: string
          error: string | null
          filled_fields: Json
          id: string
          lease_expires_at: string | null
          portal_url: string
          screenshot_path: string | null
          status: string
          stop_reason: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "portal_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      match_sponsor_company_v3: {
        Args: { max_results?: number; search_term: string; threshold?: number }
        Returns: {
          county: string
          id: number
          organisation_name: string
          route: string
          similarity: number
          town_city: string
          type_rating: string
        }[]
      }
      normalize_company_name: { Args: { raw: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
