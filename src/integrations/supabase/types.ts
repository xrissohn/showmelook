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
      cafe24_fitting_sessions: {
        Row: {
          cafe24_product_no: number
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          fitting_result_url: string | null
          id: string
          session_token: string
          tenant_id: string
        }
        Insert: {
          cafe24_product_no: number
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          fitting_result_url?: string | null
          id?: string
          session_token: string
          tenant_id: string
        }
        Update: {
          cafe24_product_no?: number
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          fitting_result_url?: string | null
          id?: string
          session_token?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe24_fitting_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "cafe24_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe24_products: {
        Row: {
          cafe24_product_no: number
          category_name: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_synced: boolean | null
          last_synced_at: string | null
          price: number
          product_code: string | null
          product_name: string
          products_cache_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cafe24_product_no: number
          category_name?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_synced?: boolean | null
          last_synced_at?: string | null
          price: number
          product_code?: string | null
          product_name: string
          products_cache_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cafe24_product_no?: number
          category_name?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_synced?: boolean | null
          last_synced_at?: string | null
          price?: number
          product_code?: string | null
          product_name?: string
          products_cache_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe24_products_products_cache_id_fkey"
            columns: ["products_cache_id"]
            isOneToOne: false
            referencedRelation: "products_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe24_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "cafe24_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe24_tenants: {
        Row: {
          access_token: string
          billing_cycle_start: string | null
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          mall_id: string
          monthly_generation_limit: number | null
          monthly_generation_used: number | null
          plan: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scopes: string[] | null
          shop_name: string | null
          shop_no: number
          updated_at: string | null
          user_id: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token: string
          billing_cycle_start?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          mall_id: string
          monthly_generation_limit?: number | null
          monthly_generation_used?: number | null
          plan?: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scopes?: string[] | null
          shop_name?: string | null
          shop_no?: number
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string
          billing_cycle_start?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          mall_id?: string
          monthly_generation_limit?: number | null
          monthly_generation_used?: number | null
          plan?: string | null
          refresh_token?: string
          refresh_token_expires_at?: string
          scopes?: string[] | null
          shop_name?: string | null
          shop_no?: number
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      cafe24_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          mall_id: string | null
          payload: Json | null
          processed_at: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          mall_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          mall_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe24_webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "cafe24_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      coupang_daily_reports: {
        Row: {
          cancel_count: number | null
          click_count: number | null
          commission: number | null
          created_at: string
          gmv: number | null
          id: string
          order_count: number | null
          processed: boolean | null
          processed_at: string | null
          report_date: string
          sub_id: string | null
          tracking_code: string | null
        }
        Insert: {
          cancel_count?: number | null
          click_count?: number | null
          commission?: number | null
          created_at?: string
          gmv?: number | null
          id?: string
          order_count?: number | null
          processed?: boolean | null
          processed_at?: string | null
          report_date: string
          sub_id?: string | null
          tracking_code?: string | null
        }
        Update: {
          cancel_count?: number | null
          click_count?: number | null
          commission?: number | null
          created_at?: string
          gmv?: number | null
          id?: string
          order_count?: number | null
          processed?: boolean | null
          processed_at?: string | null
          report_date?: string
          sub_id?: string | null
          tracking_code?: string | null
        }
        Relationships: []
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
      email_verifications: {
        Row: {
          attempts: number | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          purpose: string
          verification_code: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          purpose?: string
          verification_code: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          verification_code?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string | null
          error_code: string | null
          error_message: string | null
          execution_time_ms: number | null
          function_name: string
          id: string
          request_payload: Json | null
          response_payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          function_name: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          function_name?: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      family_profiles: {
        Row: {
          age_group: string | null
          avatar_url: string | null
          body_type: string | null
          created_at: string | null
          full_name: string
          gender: string | null
          height: number | null
          id: string
          owner_user_id: string
          relationship: string | null
          style_preferences: string[] | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          age_group?: string | null
          avatar_url?: string | null
          body_type?: string | null
          created_at?: string | null
          full_name: string
          gender?: string | null
          height?: number | null
          id?: string
          owner_user_id: string
          relationship?: string | null
          style_preferences?: string[] | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          age_group?: string | null
          avatar_url?: string | null
          body_type?: string | null
          created_at?: string | null
          full_name?: string
          gender?: string | null
          height?: number | null
          id?: string
          owner_user_id?: string
          relationship?: string | null
          style_preferences?: string[] | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      generated_looks: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          is_favorite: boolean | null
          is_public: boolean | null
          like_count: number
          memo: string | null
          product_ids: string[] | null
          prompt_used: string | null
          style_reasoning: string | null
          style_trend_id: string | null
          tag_positions: Json | null
          tags: string[] | null
          user_id: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_favorite?: boolean | null
          is_public?: boolean | null
          like_count?: number
          memo?: string | null
          product_ids?: string[] | null
          prompt_used?: string | null
          style_reasoning?: string | null
          style_trend_id?: string | null
          tag_positions?: Json | null
          tags?: string[] | null
          user_id: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_favorite?: boolean | null
          is_public?: boolean | null
          like_count?: number
          memo?: string | null
          product_ids?: string[] | null
          prompt_used?: string | null
          style_reasoning?: string | null
          style_trend_id?: string | null
          tag_positions?: Json | null
          tags?: string[] | null
          user_id?: string
          view_count?: number
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
      generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          priority: number | null
          progress: number | null
          request_payload: Json
          result_payload: Json | null
          result_url: string | null
          retry_count: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          progress?: number | null
          request_payload: Json
          result_payload?: Json | null
          result_url?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          progress?: number | null
          request_payload?: Json
          result_payload?: Json | null
          result_url?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      inference_metrics: {
        Row: {
          concepts: string[] | null
          created_at: string | null
          fallback_reason: string | null
          id: string
          occasion: string | null
          product_count: number | null
          stage1_model: string
          stage1_success: boolean | null
          stage1_time_ms: number | null
          stage2_model: string
          stage2_success: boolean | null
          stage2_time_ms: number | null
          total_time_ms: number | null
          used_fallback: boolean | null
          user_id: string | null
        }
        Insert: {
          concepts?: string[] | null
          created_at?: string | null
          fallback_reason?: string | null
          id?: string
          occasion?: string | null
          product_count?: number | null
          stage1_model: string
          stage1_success?: boolean | null
          stage1_time_ms?: number | null
          stage2_model: string
          stage2_success?: boolean | null
          stage2_time_ms?: number | null
          total_time_ms?: number | null
          used_fallback?: boolean | null
          user_id?: string | null
        }
        Update: {
          concepts?: string[] | null
          created_at?: string | null
          fallback_reason?: string | null
          id?: string
          occasion?: string | null
          product_count?: number | null
          stage1_model?: string
          stage1_success?: boolean | null
          stage1_time_ms?: number | null
          stage2_model?: string
          stage2_success?: boolean | null
          stage2_time_ms?: number | null
          total_time_ms?: number | null
          used_fallback?: boolean | null
          user_id?: string | null
        }
        Relationships: []
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
      look_likes: {
        Row: {
          created_at: string
          id: string
          look_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          look_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          look_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "look_likes_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "generated_looks"
            referencedColumns: ["id"]
          },
        ]
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
      model_config: {
        Row: {
          id: string
          is_active: boolean | null
          model_name: string
          priority: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id: string
          is_active?: boolean | null
          model_name: string
          priority?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          model_name?: string
          priority?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      monthly_generation_usage: {
        Row: {
          created_at: string
          generation_count: number
          id: string
          period_end: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generation_count?: number
          id?: string
          period_end: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generation_count?: number
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_products: {
        Row: {
          created_at: string | null
          error_message: string | null
          error_type: string
          id: string
          raw_data: Json
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number | null
          source: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          error_type: string
          id?: string
          raw_data: Json
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          source: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string
          id?: string
          raw_data?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_feedback: {
        Row: {
          action_type: string
          context: Json | null
          created_at: string | null
          id: string
          product_id: string | null
          recommendation_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          context?: Json | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          recommendation_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          context?: Json | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          recommendation_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feedback_scores: {
        Row: {
          cart_count: number
          click_count: number
          created_at: string | null
          dislike_count: number
          id: string
          like_count: number
          overall_score: number
          product_id: string
          purchase_count: number
          style_weights: Json
          updated_at: string | null
        }
        Insert: {
          cart_count?: number
          click_count?: number
          created_at?: string | null
          dislike_count?: number
          id?: string
          like_count?: number
          overall_score?: number
          product_id: string
          purchase_count?: number
          style_weights?: Json
          updated_at?: string | null
        }
        Update: {
          cart_count?: number
          click_count?: number
          created_at?: string | null
          dislike_count?: number
          id?: string
          like_count?: number
          overall_score?: number
          product_id?: string
          purchase_count?: number
          style_weights?: Json
          updated_at?: string | null
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
          dna_meta: Json | null
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
          dna_meta?: Json | null
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
          dna_meta?: Json | null
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
      profile_deletion_grace: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          grace_period_ends_at: string
          id: string
          notified_at: string | null
          profile_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          grace_period_ends_at: string
          id?: string
          notified_at?: string | null
          profile_ids: string[]
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          grace_period_ends_at?: string
          id?: string
          notified_at?: string | null
          profile_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          age_group: string | null
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
          age_group?: string | null
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
          age_group?: string | null
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
      purchase_intents: {
        Row: {
          actual_amount: number | null
          clicked_at: string
          commission: number | null
          confirmation_status: string | null
          created_at: string
          id: string
          merchant_id: string | null
          order_id: string | null
          product_id: string | null
          product_name: string | null
          product_price: number | null
          product_url: string | null
          purchased_at: string | null
          rolled_back_at: string | null
          status: string
          tier_applied_at: string | null
          tracking_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_amount?: number | null
          clicked_at?: string
          commission?: number | null
          confirmation_status?: string | null
          created_at?: string
          id?: string
          merchant_id?: string | null
          order_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: number | null
          product_url?: string | null
          purchased_at?: string | null
          rolled_back_at?: string | null
          status?: string
          tier_applied_at?: string | null
          tracking_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_amount?: number | null
          clicked_at?: string
          commission?: number | null
          confirmation_status?: string | null
          created_at?: string
          id?: string
          merchant_id?: string | null
          order_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: number | null
          product_url?: string | null
          purchased_at?: string | null
          rolled_back_at?: string | null
          status?: string
          tier_applied_at?: string | null
          tracking_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_intents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_state: {
        Row: {
          backoff_until: string | null
          consecutive_failures: number
          consecutive_successes: number
          id: string
          last_refill_at: string
          last_reset_date: string
          max_tokens: number
          refill_rate: number
          tokens: number
          total_rate_limits_today: number
          total_requests_today: number
          updated_at: string
        }
        Insert: {
          backoff_until?: string | null
          consecutive_failures?: number
          consecutive_successes?: number
          id?: string
          last_refill_at?: string
          last_reset_date?: string
          max_tokens?: number
          refill_rate?: number
          tokens?: number
          total_rate_limits_today?: number
          total_requests_today?: number
          updated_at?: string
        }
        Update: {
          backoff_until?: string | null
          consecutive_failures?: number
          consecutive_successes?: number
          id?: string
          last_refill_at?: string
          last_reset_date?: string
          max_tokens?: number
          refill_rate?: number
          tokens?: number
          total_rate_limits_today?: number
          total_requests_today?: number
          updated_at?: string
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
      recommendation_patterns: {
        Row: {
          avg_formality: number | null
          concept_weights: Json | null
          created_at: string | null
          id: string
          last_products: Json | null
          pattern_key: string
          popular_combos: Json | null
          style_feedback: Json | null
          success_rate: number | null
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          avg_formality?: number | null
          concept_weights?: Json | null
          created_at?: string | null
          id?: string
          last_products?: Json | null
          pattern_key: string
          popular_combos?: Json | null
          style_feedback?: Json | null
          success_rate?: number | null
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          avg_formality?: number | null
          concept_weights?: Json | null
          created_at?: string | null
          id?: string
          last_products?: Json | null
          pattern_key?: string
          popular_combos?: Json | null
          style_feedback?: Json | null
          success_rate?: number | null
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          used_count: number | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          used_count?: number | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          used_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          amount: number
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_permanent: boolean | null
          referee_user_id: string
          referral_code: string
          referrer_user_id: string
          remaining_amount: number
          reward_type: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_permanent?: boolean | null
          referee_user_id: string
          referral_code: string
          referrer_user_id: string
          remaining_amount?: number
          reward_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_permanent?: boolean | null
          referee_user_id?: string
          referral_code?: string
          referrer_user_id?: string
          remaining_amount?: number
          reward_type?: string
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
          look_name: string | null
          product_ids: string[]
          style_concept: string | null
          style_reasoning: string | null
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
          look_name?: string | null
          product_ids?: string[]
          style_concept?: string | null
          style_reasoning?: string | null
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
          look_name?: string | null
          product_ids?: string[]
          style_concept?: string | null
          style_reasoning?: string | null
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
      tag_corrections: {
        Row: {
          ai_x: number
          ai_y: number
          category: string
          created_at: string
          id: string
          image_url: string | null
          look_id: string
          manual_x: number
          manual_y: number
          user_id: string
        }
        Insert: {
          ai_x: number
          ai_y: number
          category: string
          created_at?: string
          id?: string
          image_url?: string | null
          look_id: string
          manual_x: number
          manual_y: number
          user_id: string
        }
        Update: {
          ai_x?: number
          ai_y?: number
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          look_id?: string
          manual_x?: number
          manual_y?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_corrections_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "generated_looks"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_change_history: {
        Row: {
          amount_change: number
          change_reason: string
          created_at: string
          id: string
          new_tier: string
          previous_tier: string
          related_order_id: string | null
          user_id: string
        }
        Insert: {
          amount_change?: number
          change_reason: string
          created_at?: string
          id?: string
          new_tier: string
          previous_tier: string
          related_order_id?: string | null
          user_id: string
        }
        Update: {
          amount_change?: number
          change_reason?: string
          created_at?: string
          id?: string
          new_tier?: string
          previous_tier?: string
          related_order_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_purchase_stats: {
        Row: {
          created_at: string
          current_tier: string
          first_purchase_at: string | null
          last_tier_change_at: string | null
          model_profile_slots: number
          pending_amount: number
          tier_updated_at: string
          total_purchased_amount: number
          total_purchases: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_tier?: string
          first_purchase_at?: string | null
          last_tier_change_at?: string | null
          model_profile_slots?: number
          pending_amount?: number
          tier_updated_at?: string
          total_purchased_amount?: number
          total_purchases?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_tier?: string
          first_purchase_at?: string | null
          last_tier_change_at?: string | null
          model_profile_slots?: number
          pending_amount?: number
          tier_updated_at?: string
          total_purchased_amount?: number
          total_purchases?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string | null
          created_at: string | null
          current_period_end: string | null
          daily_limit: number
          expires_at: string | null
          gallery_limit: number
          id: string
          max_profiles: number
          monthly_limit: number | null
          plan: string
          signup_day: number | null
          started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string | null
          current_period_end?: string | null
          daily_limit?: number
          expires_at?: string | null
          gallery_limit?: number
          id?: string
          max_profiles?: number
          monthly_limit?: number | null
          plan?: string
          signup_day?: number | null
          started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string | null
          current_period_end?: string | null
          daily_limit?: number
          expires_at?: string | null
          gallery_limit?: number
          id?: string
          max_profiles?: number
          monthly_limit?: number | null
          plan?: string
          signup_day?: number | null
          started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      referral_codes_public: {
        Row: {
          code: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          max_uses: number | null
          used_count: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          max_uses?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          max_uses?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_model_profile_slots: {
        Args: { p_total_amount: number }
        Returns: number
      }
      calculate_user_tier: { Args: { p_total_amount: number }; Returns: string }
      cleanup_duplicate_pending_products: { Args: never; Returns: number }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      cleanup_old_inference_metrics: { Args: never; Returns: undefined }
      cleanup_old_verifications: { Args: never; Returns: undefined }
      get_products_without_sub_style: {
        Args: { batch_limit?: number }
        Returns: {
          brand: string
          category: string
          color: string
          dna_meta: Json
          gender: string
          id: string
          name: string
          price: number
          style_tags: string[]
          sub_category: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    },
  },
} as const
