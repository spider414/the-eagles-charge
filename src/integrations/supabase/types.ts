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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          deposit_fee_enabled: boolean
          deposit_fee_percent: number
          id: string
          registration_bonus_amount: number
          registration_bonus_enabled: boolean
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_fee_enabled?: boolean
          deposit_fee_percent?: number
          id?: string
          registration_bonus_amount?: number
          registration_bonus_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_fee_enabled?: boolean
          deposit_fee_percent?: number
          id?: string
          registration_bonus_amount?: number
          registration_bonus_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      deposit_fee_log: {
        Row: {
          balance_after: number | null
          created_at: string
          fee_amount: number
          fee_percent: number
          gross_amount: number
          id: string
          method: string
          net_amount: number
          reference: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          fee_amount?: number
          fee_percent?: number
          gross_amount: number
          id?: string
          method: string
          net_amount: number
          reference?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          fee_amount?: number
          fee_percent?: number
          gross_amount?: number
          id?: string
          method?: string
          net_amount?: number
          reference?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_fee_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_change_requests: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          new_email: string
          purpose: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          new_email: string
          purpose?: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          new_email?: string
          purpose?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          reference: string | null
          skipped_reason: string | null
          status: string
          subject: string | null
          template_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          reference?: string | null
          skipped_reason?: string | null
          status: string
          subject?: string | null
          template_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          reference?: string | null
          skipped_reason?: string | null
          status?: string
          subject?: string | null
          template_type?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          admin_notify_email: string
          brand_name: string
          created_at: string
          dark_color: string
          footer_text: string | null
          from_address: string
          header_tagline: string | null
          id: string
          logo_emoji: string | null
          logo_url: string | null
          primary_color: string
          support_email: string
          updated_at: string
        }
        Insert: {
          admin_notify_email?: string
          brand_name?: string
          created_at?: string
          dark_color?: string
          footer_text?: string | null
          from_address?: string
          header_tagline?: string | null
          id?: string
          logo_emoji?: string | null
          logo_url?: string | null
          primary_color?: string
          support_email?: string
          updated_at?: string
        }
        Update: {
          admin_notify_email?: string
          brand_name?: string
          created_at?: string
          dark_color?: string
          footer_text?: string | null
          from_address?: string
          header_tagline?: string | null
          id?: string
          logo_emoji?: string | null
          logo_url?: string | null
          primary_color?: string
          support_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          intro: string
          outro: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          intro?: string
          outro?: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          intro?: string
          outro?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorite_numbers: {
        Row: {
          created_at: string
          id: string
          network: Database["public"]["Enums"]["network_provider"]
          nickname: string | null
          phone_number: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          network: Database["public"]["Enums"]["network_provider"]
          nickname?: string | null
          phone_number: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          network?: Database["public"]["Enums"]["network_provider"]
          nickname?: string | null
          phone_number?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_audit_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          phone_hash: string
          phone_hint: string | null
          purpose: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          phone_hash: string
          phone_hint?: string | null
          purpose?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          phone_hash?: string
          phone_hint?: string | null
          purpose?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone_number: string
          purpose: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          phone_number: string
          purpose: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone_number?: string
          purpose?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          contact_email: string | null
          contact_email_verified: boolean
          created_at: string
          deletion_reason: string | null
          deletion_scheduled_at: string | null
          dva_account_name: string | null
          dva_account_number: string | null
          dva_bank_name: string | null
          email: string
          email_marketing_opt_in: boolean
          email_product_updates_opt_in: boolean
          email_promotions_opt_in: boolean
          full_name: string | null
          id: string
          nin_full_name: string | null
          nin_number: string | null
          nin_verified: boolean | null
          payment_email_locked: boolean | null
          paystack_customer_code: string | null
          phone_number: string | null
          phone_verified: boolean | null
          referral_code: string | null
          referred_by: string | null
          security_answer: string | null
          security_question: string | null
          total_referral_earnings: number | null
          unsubscribe_token: string | null
          updated_at: string
          user_id: string
          wallet_balance: number | null
        }
        Insert: {
          avatar_url?: string | null
          contact_email?: string | null
          contact_email_verified?: boolean
          created_at?: string
          deletion_reason?: string | null
          deletion_scheduled_at?: string | null
          dva_account_name?: string | null
          dva_account_number?: string | null
          dva_bank_name?: string | null
          email: string
          email_marketing_opt_in?: boolean
          email_product_updates_opt_in?: boolean
          email_promotions_opt_in?: boolean
          full_name?: string | null
          id?: string
          nin_full_name?: string | null
          nin_number?: string | null
          nin_verified?: boolean | null
          payment_email_locked?: boolean | null
          paystack_customer_code?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          security_answer?: string | null
          security_question?: string | null
          total_referral_earnings?: number | null
          unsubscribe_token?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number | null
        }
        Update: {
          avatar_url?: string | null
          contact_email?: string | null
          contact_email_verified?: boolean
          created_at?: string
          deletion_reason?: string | null
          deletion_scheduled_at?: string | null
          dva_account_name?: string | null
          dva_account_number?: string | null
          dva_bank_name?: string | null
          email?: string
          email_marketing_opt_in?: boolean
          email_product_updates_opt_in?: boolean
          email_promotions_opt_in?: boolean
          full_name?: string | null
          id?: string
          nin_full_name?: string | null
          nin_number?: string | null
          nin_verified?: boolean | null
          payment_email_locked?: boolean | null
          paystack_customer_code?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          security_answer?: string | null
          security_question?: string | null
          total_referral_earnings?: number | null
          unsubscribe_token?: string | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_attempts: {
        Row: {
          attempt_count: number
          created_at: string
          endpoint: string
          id: string
          identifier: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_amount: number
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_amount: number
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          api_response: Json | null
          balance_after: number | null
          balance_before: number | null
          cable_plan: string | null
          cable_provider: Database["public"]["Enums"]["cable_provider"] | null
          cable_smartcard: string | null
          created_at: string
          data_plan: string | null
          description: string | null
          electricity_provider:
            | Database["public"]["Enums"]["electricity_provider"]
            | null
          id: string
          meter_number: string | null
          meter_type: string | null
          network: Database["public"]["Enums"]["network_provider"] | null
          paystack_access_code: string | null
          paystack_reference: string | null
          phone_number: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          token: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          api_response?: Json | null
          balance_after?: number | null
          balance_before?: number | null
          cable_plan?: string | null
          cable_provider?: Database["public"]["Enums"]["cable_provider"] | null
          cable_smartcard?: string | null
          created_at?: string
          data_plan?: string | null
          description?: string | null
          electricity_provider?:
            | Database["public"]["Enums"]["electricity_provider"]
            | null
          id?: string
          meter_number?: string | null
          meter_type?: string | null
          network?: Database["public"]["Enums"]["network_provider"] | null
          paystack_access_code?: string | null
          paystack_reference?: string | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          token?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          api_response?: Json | null
          balance_after?: number | null
          balance_before?: number | null
          cable_plan?: string | null
          cable_provider?: Database["public"]["Enums"]["cable_provider"] | null
          cable_smartcard?: string | null
          created_at?: string
          data_plan?: string | null
          description?: string | null
          electricity_provider?:
            | Database["public"]["Enums"]["electricity_provider"]
            | null
          id?: string
          meter_number?: string | null
          meter_type?: string | null
          network?: Database["public"]["Enums"]["network_provider"] | null
          paystack_access_code?: string | null
          paystack_reference?: string | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          token?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      admin_exists: { Args: never; Returns: boolean }
      claim_admin: { Args: never; Returns: boolean }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      credit_wallet: {
        Args: { p_amount: number; p_profile_id: string }
        Returns: number
      }
      debit_wallet: {
        Args: { p_amount: number; p_profile_id: string }
        Returns: {
          new_balance: number
          success: boolean
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolve_referral_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      cable_provider: "dstv" | "gotv" | "startimes"
      electricity_provider:
        | "ekedc"
        | "ikedc"
        | "aedc"
        | "phedc"
        | "kedco"
        | "ibedc"
        | "eedc"
        | "bedc"
        | "jedc"
        | "kaedco"
        | "yedc"
      network_provider: "mtn" | "glo" | "airtel" | "9mobile"
      transaction_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      transaction_type:
        | "airtime"
        | "data"
        | "electricity"
        | "cable_tv"
        | "internet"
        | "wallet_topup"
        | "verification"
        | "exam_pin"
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
      app_role: ["admin", "moderator", "user"],
      cable_provider: ["dstv", "gotv", "startimes"],
      electricity_provider: [
        "ekedc",
        "ikedc",
        "aedc",
        "phedc",
        "kedco",
        "ibedc",
        "eedc",
        "bedc",
        "jedc",
        "kaedco",
        "yedc",
      ],
      network_provider: ["mtn", "glo", "airtel", "9mobile"],
      transaction_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      transaction_type: [
        "airtime",
        "data",
        "electricity",
        "cable_tv",
        "internet",
        "wallet_topup",
        "verification",
        "exam_pin",
      ],
    },
  },
} as const
