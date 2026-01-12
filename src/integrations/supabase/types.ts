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
      cart_items: {
        Row: {
          created_at: string
          generated_look_id: string | null
          id: string
          product_brand: string | null
          product_id: string
          product_image_url: string | null
          product_name: string | null
          product_price: number | null
          product_source: string | null
          product_url: string | null
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_look_id?: string | null
          id?: string
          product_brand?: string | null
          product_id: string
          product_image_url?: string | null
          product_name?: string | null
          product_price?: number | null
          product_source?: string | null
          product_url?: string | null
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          generated_look_id?: string | null
          id?: string
          product_brand?: string | null
          product_id?: string
          product_image_url?: string | null
          product_name?: string | null
          product_price?: number | null
          product_source?: string | null
          product_url?: string | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_generated_look_id_fkey"
            columns: ["generated_look_id"]
            isOneToOne: false
            referencedRelation: "generated_looks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_generation_usage: {
        Row: {
          created_at: string | null
          generation_count: number | null
          id: string
          updated_at: string | null
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          generation_count?: number | null
          id?: string
          updated_at?: string | null
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          generation_count?: number | null
          id?: string
          updated_at?: string | null
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_looks: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_favorite: boolean | null
          product_ids: string[] | null
          prompt_used: string | null
          style_trend_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_favorite?: boolean | null
          product_ids?: string[] | null
          prompt_used?: string | null
          style_trend_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_favorite?: boolean | null
          product_ids?: string[] | null
          prompt_used?: string | null
          style_trend_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_looks_style_trend_id_fkey"
            columns: ["style_trend_id"]
            isOneToOne: false
            referencedRelation: "style_trends"
            referencedColumns: ["id"]
          },
        ]
      }
      liked_products: {
        Row: {
          created_at: string
          id: string
          product_brand: string | null
          product_category: string | null
          product_id: string
          product_image_url: string | null
          product_name: string
          product_price: number
          product_url: string
          style_tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_brand?: string | null
          product_category?: string | null
          product_id: string
          product_image_url?: string | null
          product_name: string
          product_price: number
          product_url: string
          style_tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_brand?: string | null
          product_category?: string | null
          product_id?: string
          product_image_url?: string | null
          product_name?: string
          product_price?: number
          product_url?: string
          style_tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          base_url: string
          commission_rate: number | null
          created_at: string | null
          deeplink_template: string
          id: string
          is_active: boolean | null
          last_collected_at: string | null
          name: string
          name_ko: string
          scrape_config: Json | null
          scrape_type: string | null
        }
        Insert: {
          base_url: string
          commission_rate?: number | null
          created_at?: string | null
          deeplink_template: string
          id: string
          is_active?: boolean | null
          last_collected_at?: string | null
          name: string
          name_ko: string
          scrape_config?: Json | null
          scrape_type?: string | null
        }
        Update: {
          base_url?: string
          commission_rate?: number | null
          created_at?: string | null
          deeplink_template?: string
          id?: string
          is_active?: boolean | null
          last_collected_at?: string | null
          name?: string
          name_ko?: string
          scrape_config?: Json | null
          scrape_type?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ko: string
          price: number
          tags: string[] | null
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_ko: string
          price: number
          tags?: string[] | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_ko?: string
          price?: number
          tags?: string[] | null
        }
        Relationships: []
      }
      products_cache: {
        Row: {
          brand: string | null
          category: string
          collected_at: string | null
          color: string | null
          dna_generated_at: string | null
          dna_text: string | null
          external_id: string | null
          gender: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_in_stock: boolean | null
          merchant_id: string | null
          name: string
          original_price: number | null
          price: number
          product_url: string
          sizes: Json | null
          style_tags: string[] | null
          sub_category: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category: string
          collected_at?: string | null
          color?: string | null
          dna_generated_at?: string | null
          dna_text?: string | null
          external_id?: string | null
          gender?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_in_stock?: boolean | null
          merchant_id?: string | null
          name: string
          original_price?: number | null
          price: number
          product_url: string
          sizes?: Json | null
          style_tags?: string[] | null
          sub_category?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          collected_at?: string | null
          color?: string | null
          dna_generated_at?: string | null
          dna_text?: string | null
          external_id?: string | null
          gender?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_in_stock?: boolean | null
          merchant_id?: string | null
          name?: string
          original_price?: number | null
          price?: number
          product_url?: string
          sizes?: Json | null
          style_tags?: string[] | null
          sub_category?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_cache_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          body_type: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          height: number | null
          id: string
          style_preferences: string[] | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          body_type?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          style_preferences?: string[] | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          body_type?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          style_preferences?: string[] | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      recommendation_history: {
        Row: {
          budget: number
          created_at: string
          gender: string
          id: string
          items: Json
          prompt: string
          style_concept: string | null
          style_reasoning: string | null
          total_price: number
          user_id: string
        }
        Insert: {
          budget: number
          created_at?: string
          gender: string
          id?: string
          items?: Json
          prompt: string
          style_concept?: string | null
          style_reasoning?: string | null
          total_price?: number
          user_id: string
        }
        Update: {
          budget?: number
          created_at?: string
          gender?: string
          id?: string
          items?: Json
          prompt?: string
          style_concept?: string | null
          style_reasoning?: string | null
          total_price?: number
          user_id?: string
        }
        Relationships: []
      }
      style_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string | null
          id: string
          image_url: string
          last_used_at: string | null
          product_ids: string[]
          style_trend_id: string | null
          use_count: number | null
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          image_url: string
          last_used_at?: string | null
          product_ids?: string[]
          style_trend_id?: string | null
          use_count?: number | null
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string
          last_used_at?: string | null
          product_ids?: string[]
          style_trend_id?: string | null
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "style_cache_style_trend_id_fkey"
            columns: ["style_trend_id"]
            isOneToOne: false
            referencedRelation: "style_trends"
            referencedColumns: ["id"]
          },
        ]
      }
      style_trends: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ko: string
          tags: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_ko: string
          tags?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_ko?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          daily_limit: number
          expires_at: string | null
          id: string
          plan: string
          started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_limit?: number
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
