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
    PostgrestVersion: "14.5"
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
      challenge_invites: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          invitee_profile_id: string
          inviter_profile_id: string
          status: Database["public"]["Enums"]["challenge_invite_status"]
          updated_at: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          invitee_profile_id: string
          inviter_profile_id: string
          status?: Database["public"]["Enums"]["challenge_invite_status"]
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          invitee_profile_id?: string
          inviter_profile_id?: string
          status?: Database["public"]["Enums"]["challenge_invite_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_invites_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_invites_invitee_profile_id_fkey"
            columns: ["invitee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_invites_inviter_profile_id_fkey"
            columns: ["inviter_profile_id"]
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
          score: number
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
          score?: number
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
          score?: number
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
          category: Database["public"]["Enums"]["challenge_category"]
          challenge_code: string
          created_at: string
          description: string | null
          end_date: string
          goal_mode: Database["public"]["Enums"]["challenge_goal_mode"]
          icon: string | null
          id: string
          is_active: boolean
          leaderboard_visibility: Database["public"]["Enums"]["challenge_board_visibility"]
          max_score: number
          metric: string
          owner_profile_id: string | null
          participation_visibility: Database["public"]["Enums"]["challenge_participation"]
          reward_points: number
          scoring_type: Database["public"]["Enums"]["challenge_scoring_type"]
          start_date: string
          status: Database["public"]["Enums"]["challenge_status"]
          target_source: Database["public"]["Enums"]["challenge_target_source"]
          target_value: number
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["challenge_category"]
          challenge_code?: string
          created_at?: string
          description?: string | null
          end_date: string
          goal_mode?: Database["public"]["Enums"]["challenge_goal_mode"]
          icon?: string | null
          id?: string
          is_active?: boolean
          leaderboard_visibility?: Database["public"]["Enums"]["challenge_board_visibility"]
          max_score?: number
          metric?: string
          owner_profile_id?: string | null
          participation_visibility?: Database["public"]["Enums"]["challenge_participation"]
          reward_points?: number
          scoring_type?: Database["public"]["Enums"]["challenge_scoring_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          target_source?: Database["public"]["Enums"]["challenge_target_source"]
          target_value?: number
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["challenge_category"]
          challenge_code?: string
          created_at?: string
          description?: string | null
          end_date?: string
          goal_mode?: Database["public"]["Enums"]["challenge_goal_mode"]
          icon?: string | null
          id?: string
          is_active?: boolean
          leaderboard_visibility?: Database["public"]["Enums"]["challenge_board_visibility"]
          max_score?: number
          metric?: string
          owner_profile_id?: string | null
          participation_visibility?: Database["public"]["Enums"]["challenge_participation"]
          reward_points?: number
          scoring_type?: Database["public"]["Enums"]["challenge_scoring_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          target_source?: Database["public"]["Enums"]["challenge_target_source"]
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_profile_id: string
          sender_profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_profile_id: string
          sender_profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_profile_id?: string
          sender_profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_profile_id_fkey"
            columns: ["receiver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_profile_id: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          friend_profile_id: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          friend_profile_id?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_profile_id_fkey"
            columns: ["friend_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_profile_id_fkey"
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
          friend_code: string
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
          friend_code?: string
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
          friend_code?: string
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
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      can_view_avatar_folder: { Args: { _folder: string }; Returns: boolean }
      can_view_challenge: { Args: { _challenge_id: string }; Returns: boolean }
      challenge_detail: {
        Args: { _challenge_id: string }
        Returns: Database["public"]["CompositeTypes"]["challenge_view"][]
        SetofOptions: {
          from: "*"
          to: "challenge_view"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      challenge_leaderboard: {
        Args: { _challenge_id: string; _friends_only?: boolean }
        Returns: {
          completed: boolean
          display_name: string
          is_friend: boolean
          is_self: boolean
          picture_url: string
          profile_id: string
          progress: number
        }[]
      }
      challenge_metric_daily: {
        Args: {
          _from: string
          _metric: string
          _profile_id: string
          _to: string
        }
        Returns: {
          d: string
          v: number
        }[]
      }
      compute_challenge_progress: {
        Args: { _challenge_id: string; _profile_id: string }
        Returns: number
      }
      create_challenge: {
        Args: {
          _board: Database["public"]["Enums"]["challenge_board_visibility"]
          _category: Database["public"]["Enums"]["challenge_category"]
          _description: string
          _end_date: string
          _goal_mode: Database["public"]["Enums"]["challenge_goal_mode"]
          _icon?: string
          _metric: string
          _participation: Database["public"]["Enums"]["challenge_participation"]
          _start_date: string
          _target_value: number
          _title: string
        }
        Returns: {
          category: Database["public"]["Enums"]["challenge_category"]
          challenge_code: string
          created_at: string
          description: string | null
          end_date: string
          goal_mode: Database["public"]["Enums"]["challenge_goal_mode"]
          icon: string | null
          id: string
          is_active: boolean
          leaderboard_visibility: Database["public"]["Enums"]["challenge_board_visibility"]
          max_score: number
          metric: string
          owner_profile_id: string | null
          participation_visibility: Database["public"]["Enums"]["challenge_participation"]
          reward_points: number
          scoring_type: Database["public"]["Enums"]["challenge_scoring_type"]
          start_date: string
          status: Database["public"]["Enums"]["challenge_status"]
          target_source: Database["public"]["Enums"]["challenge_target_source"]
          target_value: number
          title: string
          unit: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_profile_id: { Args: never; Returns: string }
      friend_public_profile: {
        Args: { _profile_id: string }
        Returns: {
          activity_count: number
          challenge_count: number
          display_name: string
          friend_code: string
          picture_url: string
          privacy_level: Database["public"]["Enums"]["privacy_level"]
          profile_id: string
          streak_days: number
          visible: boolean
        }[]
      }
      friend_summary: {
        Args: never
        Returns: {
          friend_count: number
          pending_incoming: number
          pending_outgoing: number
        }[]
      }
      generate_challenge_code: { Args: never; Returns: string }
      generate_friend_code: { Args: never; Returns: string }
      invite_friend_to_challenge: {
        Args: { _challenge_id: string; _friend_profile_id: string }
        Returns: string
      }
      join_challenge: { Args: { _challenge_id: string }; Returns: undefined }
      leave_challenge: { Args: { _challenge_id: string }; Returns: undefined }
      list_challenge_invites: {
        Args: never
        Returns: {
          challenge_code: string
          challenge_id: string
          challenge_title: string
          counterpart_name: string
          counterpart_picture: string
          created_at: string
          direction: string
          id: string
          status: Database["public"]["Enums"]["challenge_invite_status"]
        }[]
      }
      list_friend_requests: {
        Args: never
        Returns: {
          created_at: string
          direction: string
          display_name: string
          friend_code: string
          id: string
          picture_url: string
          profile_id: string
        }[]
      }
      list_friends: {
        Args: never
        Returns: {
          display_name: string
          friend_code: string
          picture_url: string
          privacy_level: Database["public"]["Enums"]["privacy_level"]
          profile_id: string
          since: string
        }[]
      }
      list_visible_challenges: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["challenge_view"][]
        SetofOptions: {
          from: "*"
          to: "challenge_view"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_challenge_code: {
        Args: { _code: string }
        Returns: Database["public"]["CompositeTypes"]["challenge_view"][]
        SetofOptions: {
          from: "*"
          to: "challenge_view"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_friend_code: {
        Args: { _code: string }
        Returns: {
          display_name: string
          friend_code: string
          is_friend: boolean
          is_self: boolean
          picture_url: string
          privacy_level: Database["public"]["Enums"]["privacy_level"]
          profile_id: string
          request_status: string
        }[]
      }
      remove_friend: {
        Args: { _friend_profile_id: string }
        Returns: undefined
      }
      respond_challenge_invite: {
        Args: { _action: string; _invite_id: string }
        Returns: undefined
      }
      respond_friend_request: {
        Args: { _action: string; _request_id: string }
        Returns: undefined
      }
      send_friend_request: { Args: { _code: string }; Returns: string }
      sync_challenge_progress: { Args: never; Returns: undefined }
    }
    Enums: {
      activity_level:
        | "sedentary"
        | "light"
        | "moderate"
        | "active"
        | "very_active"
      challenge_board_visibility: "everyone" | "friends" | "participants"
      challenge_category:
        | "movement"
        | "exercise"
        | "water"
        | "wellness"
        | "custom"
        | "sleep"
      challenge_goal_mode: "daily" | "cumulative"
      challenge_invite_status: "pending" | "accepted" | "rejected" | "cancelled"
      challenge_participation: "everyone" | "friends" | "invite_only"
      challenge_scoring_type: "daily_completion" | "progress_percentage"
      challenge_status: "open" | "running" | "ended" | "closed" | "cancelled"
      challenge_target_source: "fixed" | "personal_goal"
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
      challenge_view: {
        id: string | null
        title: string | null
        description: string | null
        icon: string | null
        challenge_code: string | null
        category: Database["public"]["Enums"]["challenge_category"] | null
        metric: string | null
        target_value: number | null
        unit: string | null
        goal_mode: Database["public"]["Enums"]["challenge_goal_mode"] | null
        start_date: string | null
        end_date: string | null
        reward_points: number | null
        participation_visibility:
          | Database["public"]["Enums"]["challenge_participation"]
          | null
        leaderboard_visibility:
          | Database["public"]["Enums"]["challenge_board_visibility"]
          | null
        owner_profile_id: string | null
        owner_name: string | null
        owner_picture: string | null
        is_owner: boolean | null
        participant_count: number | null
        joined: boolean | null
        my_progress: number | null
        my_completed: boolean | null
        invited: boolean | null
      }
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
    Enums: {
      activity_level: [
        "sedentary",
        "light",
        "moderate",
        "active",
        "very_active",
      ],
      challenge_board_visibility: ["everyone", "friends", "participants"],
      challenge_category: [
        "movement",
        "exercise",
        "water",
        "wellness",
        "custom",
        "sleep",
      ],
      challenge_goal_mode: ["daily", "cumulative"],
      challenge_invite_status: ["pending", "accepted", "rejected", "cancelled"],
      challenge_participation: ["everyone", "friends", "invite_only"],
      challenge_scoring_type: ["daily_completion", "progress_percentage"],
      challenge_status: ["open", "running", "ended", "closed", "cancelled"],
      challenge_target_source: ["fixed", "personal_goal"],
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
