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
      access_tokens: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_primary: boolean | null
          playlist_id: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_primary?: boolean | null
          playlist_id?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_primary?: boolean | null
          playlist_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_tokens_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          meta: Json | null
          severity: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          meta?: Json | null
          severity?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          meta?: Json | null
          severity?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      analytics: {
        Row: {
          device_id: string | null
          duration_watched: number | null
          id: string
          played_at: string | null
          video_id: string | null
        }
        Insert: {
          device_id?: string | null
          duration_watched?: number | null
          id?: string
          played_at?: string | null
          video_id?: string | null
        }
        Update: {
          device_id?: string | null
          duration_watched?: number | null
          id?: string
          played_at?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_seen: string | null
          latitude: number | null
          location_label: string | null
          longitude: number | null
          name: string | null
          playlist_id: string | null
          region: string | null
          timezone: string | null
          user_agent: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          name?: string | null
          playlist_id?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          name?: string | null
          playlist_id?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          loop: boolean | null
          name: string
          settings: Json | null
          transition_duration: number | null
          transition_image_url: string | null
          transition_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          loop?: boolean | null
          name: string
          settings?: Json | null
          transition_duration?: number | null
          transition_image_url?: string | null
          transition_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          loop?: boolean | null
          name?: string
          settings?: Json | null
          transition_duration?: number | null
          transition_image_url?: string | null
          transition_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string | null
          days_of_week: number[] | null
          id: string
          is_active: boolean
          label: string | null
          specific_date: string | null
          target_id: string
          target_type: string
          time_end: string
          time_start: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          days_of_week?: number[] | null
          id?: string
          is_active?: boolean
          label?: string | null
          specific_date?: string | null
          target_id: string
          target_type: string
          time_end: string
          time_start: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[] | null
          id?: string
          is_active?: boolean
          label?: string | null
          specific_date?: string | null
          target_id?: string
          target_type?: string
          time_end?: string
          time_start?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          resolved: boolean
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resolved?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resolved?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profile: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          plan: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          plan?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          plan?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string | null
          duration: number | null
          file_size: number | null
          filename: string
          id: string
          is_active: boolean
          mime_type: string | null
          order_index: number | null
          page_number: number
          playlist_id: string | null
          storage_path: string
          thumbnail_url: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          file_size?: number | null
          filename: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          order_index?: number | null
          page_number?: number
          playlist_id?: string | null
          storage_path: string
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          file_size?: number | null
          filename?: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          order_index?: number | null
          page_number?: number
          playlist_id?: string | null
          storage_path?: string
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_inactive_devices: { Args: never; Returns: undefined }
      device_heartbeat:
        | {
            Args: {
              p_device_fingerprint: string
              p_device_name?: string
              p_ip_address?: string
              p_token: string
              p_user_agent?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_city?: string
              p_country?: string
              p_device_fingerprint: string
              p_device_name?: string
              p_ip_address?: string
              p_latitude?: number
              p_longitude?: number
              p_region?: string
              p_timezone?: string
              p_token: string
              p_user_agent?: string
            }
            Returns: Json
          }
      get_active_screens: { Args: { p_playlist_id: string }; Returns: number }
      get_all_active_screens: {
        Args: never
        Returns: {
          active_count: number
          playlist_id: string
        }[]
      }
      get_analytics_by_video: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          last_played_at: string
          playlist_id: string
          playlist_name: string
          total_duration: number
          total_plays: number
          unique_devices: number
          video_id: string
          video_name: string
        }[]
      }
      get_analytics_summary: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          last_played_at: string
          playlist_id: string
          playlist_name: string
          total_duration: number
          total_plays: number
          unique_devices: number
        }[]
      }
      get_my_devices: {
        Args: never
        Returns: {
          address: string
          city: string
          country: string
          created_at: string
          id: string
          ip_address: string
          is_active: boolean
          is_online: boolean
          last_seen: string
          latitude: number
          location_label: string
          longitude: number
          name: string
          playlist_id: string
          playlist_name: string
          region: string
          timezone: string
          user_agent: string
        }[]
      }
      get_my_schedules: {
        Args: never
        Returns: {
          created_at: string
          days_of_week: number[]
          id: string
          is_active: boolean
          label: string
          specific_date: string
          target_id: string
          target_name: string
          target_type: string
          time_end: string
          time_start: string
        }[]
      }
      get_my_videos: {
        Args: never
        Returns: {
          created_at: string
          duration: number
          file_size: number
          filename: string
          id: string
          mime_type: string
          order_index: number
          playlist_id: string
          storage_path: string
          thumbnail_url: string
          title: string
        }[]
      }
      get_or_create_playlist_token: {
        Args: { p_playlist_id: string }
        Returns: string
      }
      get_playlist_by_token: { Args: { p_token: string }; Returns: Json }
      get_playlist_updated_at: { Args: { p_token: string }; Returns: string }
      get_recent_activity: {
        Args: { p_limit?: number; p_type?: string }
        Returns: {
          created_at: string
          description: string
          id: string
          meta: Json
          severity: string
          title: string
          type: string
        }[]
      }
      insert_video: {
        Args: {
          p_duration?: number
          p_file_size?: number
          p_filename: string
          p_mime_type?: string
          p_storage_path: string
        }
        Returns: Json
      }
      log_player_error: {
        Args: {
          p_device_id: string
          p_error_msg: string
          p_token: string
          p_video_id?: string
        }
        Returns: undefined
      }
      log_upload_error: {
        Args: { p_error_message: string; p_filename: string; p_stage?: string }
        Returns: undefined
      }
      process_schedules: { Args: never; Returns: undefined }
      record_analytics: {
        Args: { p_device_id: string; p_duration?: number; p_video_id: string }
        Returns: undefined
      }
      remove_device: { Args: { p_device_id: string }; Returns: Json }
      set_user_plan: {
        Args: { p_plan: string; p_user_id: string }
        Returns: undefined
      }
      toggle_video_active: { Args: { p_video_id: string }; Returns: boolean }
      update_device_info: {
        Args: {
          p_address?: string
          p_device_id: string
          p_location_label?: string
          p_name?: string
        }
        Returns: Json
      }
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
