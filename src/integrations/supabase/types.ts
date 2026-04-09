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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      brand_assets: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          image_url: string
          label: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          image_url: string
          label?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          image_url?: string
          label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_brief: string | null
          brand_voice_rules: string | null
          campaign_id: string | null
          created_at: string
          extra_colors: Json | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          negative_prompts: string | null
          primary_color: string
          secondary_color: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_brief?: string | null
          brand_voice_rules?: string | null
          campaign_id?: string | null
          created_at?: string
          extra_colors?: Json | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          negative_prompts?: string | null
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_brief?: string | null
          brand_voice_rules?: string | null
          campaign_id?: string | null
          created_at?: string
          extra_colors?: Json | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          negative_prompts?: string | null
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          actual_height: number | null
          actual_width: number | null
          brand_id: string
          campaign_id: string | null
          campaign_message: string | null
          copywriting: Json | null
          created_at: string
          id: string
          layout_guide: string | null
          output_format: string | null
          output_image_url: string | null
          reference_image_url: string | null
          requested_aspect_ratio: string | null
          requested_height: number | null
          requested_width: number | null
          status: string
          target_audience: string | null
          user_id: string
        }
        Insert: {
          actual_height?: number | null
          actual_width?: number | null
          brand_id: string
          campaign_id?: string | null
          campaign_message?: string | null
          copywriting?: Json | null
          created_at?: string
          id?: string
          layout_guide?: string | null
          output_format?: string | null
          output_image_url?: string | null
          reference_image_url?: string | null
          requested_aspect_ratio?: string | null
          requested_height?: number | null
          requested_width?: number | null
          status?: string
          target_audience?: string | null
          user_id: string
        }
        Update: {
          actual_height?: number | null
          actual_width?: number | null
          brand_id?: string
          campaign_id?: string | null
          campaign_message?: string | null
          copywriting?: Json | null
          created_at?: string
          id?: string
          layout_guide?: string | null
          output_format?: string | null
          output_image_url?: string | null
          reference_image_url?: string | null
          requested_aspect_ratio?: string | null
          requested_height?: number | null
          requested_width?: number | null
          status?: string
          target_audience?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          credits_remaining: number
          credits_used: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          credits_remaining?: number
          credits_used?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          credits_remaining?: number
          credits_used?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
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
      deduct_credit: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
