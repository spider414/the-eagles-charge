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
          created_at: string
          deletion_reason: string | null
          deletion_scheduled_at: string | null
          dva_account_name: string | null
          dva_account_number: string | null
          dva_bank_name: string | null
          email: string
          full_name: string | null
          id: string
          paystack_customer_code: string | null
          phone_number: string | null
          phone_verified: boolean | null
          referral_code: string | null
          referred_by: string | null
          security_answer: string | null
          security_question: string | null
          total_referral_earnings: number | null
          updated_at: string
          user_id: string
          wallet_balance: number | null
        }
        Insert: {
          created_at?: string
          deletion_reason?: string | null
          deletion_scheduled_at?: string | null
          dva_account_name?: string | null
          dva_account_number?: string | null
          dva_bank_name?: string | null
          email: string
          full_name?: string | null
          id?: string
          paystack_customer_code?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          security_answer?: string | null
          security_question?: string | null
          total_referral_earnings?: number | null
          updated_at?: string
          user_id: string
          wallet_balance?: number | null
        }
        Update: {
          created_at?: string
          deletion_reason?: string | null
          deletion_scheduled_at?: string | null
          dva_account_name?: string | null
          dva_account_number?: string | null
          dva_bank_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          paystack_customer_code?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          security_answer?: string | null
          security_question?: string | null
          total_referral_earnings?: number | null
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
          cable_plan: string | null
          cable_provider: Database["public"]["Enums"]["cable_provider"] | null
          cable_smartcard: string | null
          created_at: string
          data_plan: string | null
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
          cable_plan?: string | null
          cable_provider?: Database["public"]["Enums"]["cable_provider"] | null
          cable_smartcard?: string | null
          created_at?: string
          data_plan?: string | null
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
          cable_plan?: string | null
          cable_provider?: Database["public"]["Enums"]["cable_provider"] | null
          cable_smartcard?: string | null
          created_at?: string
          data_plan?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_otps: { Args: never; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
    }
    Enums: {
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
      ],
    },
  },
} as const
