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
      activity_logs: {
        Row: {
          activity_name: string
          activity_type_id: string
          calories: number
          created_at: string
          deleted_at: string | null
          distance_km: number | null
          distance_source: string | null
          distance_synced: boolean
          duration_minutes: number
          id: string
          met_value: number
          notes: string | null
          performed_at: string
          profile_id: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          activity_name: string
          activity_type_id: string
          calories: number
          created_at?: string
          deleted_at?: string | null
          distance_km?: number | null
          distance_source?: string | null
          distance_synced?: boolean
          duration_minutes: number
          id?: string
          met_value: number
          notes?: string | null
          performed_at?: string
          profile_id: string
          updated_at?: string
          weight_kg: number
        }
        Update: {
          activity_name?: string
          activity_type_id?: string
          calories?: number
          created_at?: string
          deleted_at?: string | null
          distance_km?: number | null
          distance_source?: string | null
          distance_synced?: boolean
          duration_minutes?: number
          id?: string
          met_value?: number
          notes?: string | null
          performed_at?: string
          profile_id?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_types: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_builtin: boolean
          met_value: number
          name: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_builtin?: boolean
          met_value: number
          name: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_builtin?: boolean
          met_value?: number
          name?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_types_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          profile_id: string
          role: Database["public"]["Enums"]["chat_role"]
          session_id: string
          tokens: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          profile_id: string
          role: Database["public"]["Enums"]["chat_role"]
          session_id?: string
          tokens?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          profile_id?: string
          role?: Database["public"]["Enums"]["chat_role"]
          session_id?: string
          tokens?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          recommendation: string
          recommendation_type: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          recommendation: string
          recommendation_type?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          recommendation?: string
          recommendation_type?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_scan_history: {
        Row: {
          ai_result: Json
          calories: number | null
          created_at: string
          food_log_id: string | null
          id: string
          image_url: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          ai_result?: Json
          calories?: number | null
          created_at?: string
          food_log_id?: string | null
          id?: string
          image_url?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          ai_result?: Json
          calories?: number | null
          created_at?: string
          food_log_id?: string | null
          id?: string
          image_url?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_scan_history_food_log_id_fkey"
            columns: ["food_log_id"]
            isOneToOne: false
            referencedRelation: "food_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_scan_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          module: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          module: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          module?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          profile_id: string
          progress: number
          updated_at: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          profile_id: string
          progress?: number
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          progress?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          icon: string | null
          id: string
          is_active: boolean
          reward_points: number
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          icon?: string | null
          id?: string
          is_active?: boolean
          reward_points?: number
          start_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          reward_points?: number
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_goals: {
        Row: {
          calories_goal: number
          carb_goal_g: number
          created_at: string
          effective_date: string
          fat_goal_g: number
          id: string
          profile_id: string
          protein_goal_g: number
          sleep_goal_minutes: number
          steps_goal: number
          updated_at: string
          water_goal_ml: number
        }
        Insert: {
          calories_goal?: number
          carb_goal_g?: number
          created_at?: string
          effective_date?: string
          fat_goal_g?: number
          id?: string
          profile_id: string
          protein_goal_g?: number
          sleep_goal_minutes?: number
          steps_goal?: number
          updated_at?: string
          water_goal_ml?: number
        }
        Update: {
          calories_goal?: number
          carb_goal_g?: number
          created_at?: string
          effective_date?: string
          fat_goal_g?: number
          id?: string
          profile_id?: string
          protein_goal_g?: number
          sleep_goal_minutes?: number
          steps_goal?: number
          updated_at?: string
          water_goal_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_statistics: {
        Row: {
          calories: number
          created_at: string
          exercise_minutes: number
          health_score: number | null
          heart_rate_avg: number | null
          id: string
          profile_id: string
          sleep_minutes: number
          spo2_avg: number | null
          stat_date: string
          steps: number
          updated_at: string
          water_ml: number
        }
        Insert: {
          calories?: number
          created_at?: string
          exercise_minutes?: number
          health_score?: number | null
          heart_rate_avg?: number | null
          id?: string
          profile_id: string
          sleep_minutes?: number
          spo2_avg?: number | null
          stat_date?: string
          steps?: number
          updated_at?: string
          water_ml?: number
        }
        Update: {
          calories?: number
          created_at?: string
          exercise_minutes?: number
          health_score?: number | null
          heart_rate_avg?: number | null
          id?: string
          profile_id?: string
          sleep_minutes?: number
          spo2_avg?: number | null
          stat_date?: string
          steps?: number
          updated_at?: string
          water_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_statistics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_goals: {
        Row: {
          created_at: string
          end_date: string
          goal_type: string
          id: string
          name: string
          period: string
          profile_id: string
          start_date: string
          status: string
          target_value: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          goal_type: string
          id?: string
          name: string
          period?: string
          profile_id: string
          start_date?: string
          status?: string
          target_value: number
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          goal_type?: string
          id?: string
          name?: string
          period?: string
          profile_id?: string
          start_date?: string
          status?: string
          target_value?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_logs: {
        Row: {
          activity_type: string
          average_heart_rate: number | null
          calories: number
          created_at: string
          duration_minutes: number
          id: string
          profile_id: string
          recorded_at: string
          source: string
          updated_at: string
        }
        Insert: {
          activity_type: string
          average_heart_rate?: number | null
          calories?: number
          created_at?: string
          duration_minutes: number
          id?: string
          profile_id: string
          recorded_at?: string
          source?: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          average_heart_rate?: number | null
          calories?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          profile_id?: string
          recorded_at?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_assets: {
        Row: {
          bucket_name: string
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_assets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_logs: {
        Row: {
          ai_confidence: number | null
          calories: number
          carbohydrates_g: number
          created_at: string
          fat_g: number
          fiber_g: number | null
          food_name: string
          id: string
          image_url: string | null
          meal_type: Database["public"]["Enums"]["meal_type"]
          profile_id: string
          protein_g: number
          recorded_at: string
          sodium_mg: number | null
          sugar_g: number | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          calories?: number
          carbohydrates_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          food_name: string
          id?: string
          image_url?: string | null
          meal_type?: Database["public"]["Enums"]["meal_type"]
          profile_id: string
          protein_g?: number
          recorded_at?: string
          sodium_mg?: number | null
          sugar_g?: number | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          calories?: number
          carbohydrates_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          food_name?: string
          id?: string
          image_url?: string | null
          meal_type?: Database["public"]["Enums"]["meal_type"]
          profile_id?: string
          protein_g?: number
          recorded_at?: string
          sodium_mg?: number | null
          sugar_g?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          profile_id: string
          progress_date: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          profile_id: string
          progress_date?: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          profile_id?: string
          progress_date?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "exercise_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_kind: Database["public"]["Enums"]["device_kind"]
          device_name: string | null
          id: string
          ingest_token: string
          last_sync_at: string | null
          pair_code: string
          pair_status: Database["public"]["Enums"]["pair_status"]
          paired_at: string | null
          platform: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_kind?: Database["public"]["Enums"]["device_kind"]
          device_name?: string | null
          id?: string
          ingest_token?: string
          last_sync_at?: string | null
          pair_code: string
          pair_status?: Database["public"]["Enums"]["pair_status"]
          paired_at?: string | null
          platform?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_kind?: Database["public"]["Enums"]["device_kind"]
          device_name?: string | null
          id?: string
          ingest_token?: string
          last_sync_at?: string | null
          pair_code?: string
          pair_status?: Database["public"]["Enums"]["pair_status"]
          paired_at?: string | null
          platform?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_samples: {
        Row: {
          created_at: string
          device_id: string
          id: string
          metric: string
          profile_id: string | null
          recorded_at: string
          source: string | null
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          metric: string
          profile_id?: string | null
          recorded_at: string
          source?: string | null
          unit?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          metric?: string
          profile_id?: string | null
          recorded_at?: string
          source?: string | null
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_samples_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "health_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_samples_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          profile_id: string
          read: boolean
          scheduled_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          profile_id: string
          read?: boolean
          scheduled_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          profile_id?: string
          read?: boolean
          scheduled_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"]
          birthday: string | null
          created_at: string
          display_name: string
          email: string | null
          gender: Database["public"]["Enums"]["gender"]
          height_cm: number | null
          id: string
          language: string
          line_user_id: string | null
          picture_url: string | null
          streak_days: number
          target_weight_kg: number | null
          timezone: string
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"]
          birthday?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          gender?: Database["public"]["Enums"]["gender"]
          height_cm?: number | null
          id?: string
          language?: string
          line_user_id?: string | null
          picture_url?: string | null
          streak_days?: number
          target_weight_kg?: number | null
          timezone?: string
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"]
          birthday?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          gender?: Database["public"]["Enums"]["gender"]
          height_cm?: number | null
          id?: string
          language?: string
          line_user_id?: string | null
          picture_url?: string | null
          streak_days?: number
          target_weight_kg?: number | null
          timezone?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_icon: string | null
          badge_name: string
          created_at: string
          id: string
          profile_id: string
          unlocked_at: string
          updated_at: string
        }
        Insert: {
          badge_icon?: string | null
          badge_name: string
          created_at?: string
          id?: string
          profile_id: string
          unlocked_at?: string
          updated_at?: string
        }
        Update: {
          badge_icon?: string | null
          badge_name?: string
          created_at?: string
          id?: string
          profile_id?: string
          unlocked_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          health_permission: boolean
          id: string
          language: string
          notification_enabled: boolean
          privacy_level: Database["public"]["Enums"]["privacy_level"]
          profile_id: string
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          health_permission?: boolean
          id?: string
          language?: string
          notification_enabled?: boolean
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          profile_id: string
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          health_permission?: boolean
          id?: string
          language?: string
          notification_enabled?: boolean
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          profile_id?: string
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_logs: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          profile_id: string
          recorded_at: string
          updated_at: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          id?: string
          profile_id: string
          recorded_at?: string
          updated_at?: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          profile_id?: string
          recorded_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_id: { Args: never; Returns: string }
    }
    Enums: {
      activity_level:
        | "sedentary"
        | "light"
        | "moderate"
        | "active"
        | "very_active"
      chat_role: "user" | "assistant" | "system"
      device_kind:
        | "smartwatch"
        | "health_connect"
        | "apple_health"
        | "manual"
        | "other"
      device_platform:
        | "android"
        | "ios"
        | "wearos"
        | "watchos"
        | "web"
        | "other"
      gender: "male" | "female" | "other" | "undisclosed"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      metric_type:
        | "steps"
        | "distance_km"
        | "calories_burned"
        | "calories_intake"
        | "heart_rate"
        | "resting_heart_rate"
        | "spo2"
        | "sleep_minutes"
        | "water_ml"
        | "exercise_minutes"
        | "active_minutes"
        | "body_weight_kg"
        | "bmi"
      notification_type:
        | "reminder"
        | "achievement"
        | "coach"
        | "system"
        | "challenge"
      pair_status: "pending" | "paired" | "revoked"
      privacy_level: "private" | "friends" | "public"
      risk_level: "low" | "medium" | "high"
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
      activity_level: [
        "sedentary",
        "light",
        "moderate",
        "active",
        "very_active",
      ],
      chat_role: ["user", "assistant", "system"],
      device_kind: [
        "smartwatch",
        "health_connect",
        "apple_health",
        "manual",
        "other",
      ],
      device_platform: ["android", "ios", "wearos", "watchos", "web", "other"],
      gender: ["male", "female", "other", "undisclosed"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      metric_type: [
        "steps",
        "distance_km",
        "calories_burned",
        "calories_intake",
        "heart_rate",
        "resting_heart_rate",
        "spo2",
        "sleep_minutes",
        "water_ml",
        "exercise_minutes",
        "active_minutes",
        "body_weight_kg",
        "bmi",
      ],
      notification_type: [
        "reminder",
        "achievement",
        "coach",
        "system",
        "challenge",
      ],
      pair_status: ["pending", "paired", "revoked"],
      privacy_level: ["private", "friends", "public"],
      risk_level: ["low", "medium", "high"],
    },
  },
} as const
