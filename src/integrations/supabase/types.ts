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
      active_plan_selection: {
        Row: {
          nutrition_plan_id: string | null
          nutrition_plan_type: Database["public"]["Enums"]["plan_source"] | null
          updated_at: string
          user_id: string
          workout_plan_id: string | null
          workout_plan_type: Database["public"]["Enums"]["plan_source"] | null
        }
        Insert: {
          nutrition_plan_id?: string | null
          nutrition_plan_type?:
            | Database["public"]["Enums"]["plan_source"]
            | null
          updated_at?: string
          user_id: string
          workout_plan_id?: string | null
          workout_plan_type?: Database["public"]["Enums"]["plan_source"] | null
        }
        Update: {
          nutrition_plan_id?: string | null
          nutrition_plan_type?:
            | Database["public"]["Enums"]["plan_source"]
            | null
          updated_at?: string
          user_id?: string
          workout_plan_id?: string | null
          workout_plan_type?: Database["public"]["Enums"]["plan_source"] | null
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          calories: number | null
          id: string
          logged_at: string
          meal_name: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["plan_source"]
          user_id: string
        }
        Insert: {
          calories?: number | null
          id?: string
          logged_at?: string
          meal_name: string
          source_id?: string | null
          source_type: Database["public"]["Enums"]["plan_source"]
          user_id: string
        }
        Update: {
          calories?: number | null
          id?: string
          logged_at?: string
          meal_name?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["plan_source"]
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      nutrition_plans: {
        Row: {
          created_at: string
          description: string | null
          goal: Database["public"]["Enums"]["fitness_goal"]
          id: string
          is_public: boolean
          max_calories: number
          meals: Json
          min_calories: number
          name: string
          owner_user_id: string | null
          trainer_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          goal: Database["public"]["Enums"]["fitness_goal"]
          id?: string
          is_public?: boolean
          max_calories: number
          meals?: Json
          min_calories: number
          name: string
          owner_user_id?: string | null
          trainer_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          goal?: Database["public"]["Enums"]["fitness_goal"]
          id?: string
          is_public?: boolean
          max_calories?: number
          meals?: Json
          min_calories?: number
          name?: string
          owner_user_id?: string | null
          trainer_id?: string | null
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          trainer_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          trainer_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          trainer_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          id: string
          logged_at: string
          notes: string | null
          user_id: string
          weight: number
        }
        Insert: {
          id?: string
          logged_at?: string
          notes?: string | null
          user_id: string
          weight: number
        }
        Update: {
          id?: string
          logged_at?: string
          notes?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          status: string
          trainer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          trainer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          trainer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trainer_favorites: {
        Row: {
          created_at: string
          trainer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          trainer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          trainer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trainer_profiles: {
        Row: {
          bio: string | null
          created_at: string
          experience_years: number
          hero_image: string | null
          specialization: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          experience_years?: number
          hero_image?: string | null
          specialization: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          experience_years?: number
          hero_image?: string | null
          specialization?: string
          user_id?: string
        }
        Relationships: []
      }
      user_fitness_profile: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"]
          age: number
          bmi: number | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          frequency: number
          goal: Database["public"]["Enums"]["fitness_goal"]
          height: number
          injuries: string | null
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          activity_level: Database["public"]["Enums"]["activity_level"]
          age: number
          bmi?: number | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          frequency: number
          goal: Database["public"]["Enums"]["fitness_goal"]
          height: number
          injuries?: string | null
          updated_at?: string
          user_id: string
          weight: number
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"]
          age?: number
          bmi?: number | null
          equipment?: Database["public"]["Enums"]["equipment_type"]
          frequency?: number
          goal?: Database["public"]["Enums"]["fitness_goal"]
          height?: number
          injuries?: string | null
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      user_nutrition_plans: {
        Row: {
          created_at: string
          id: string
          meals: Json
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meals?: Json
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meals?: Json
          name?: string
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
      user_workout_plans: {
        Row: {
          created_at: string
          id: string
          name: string
          schedule: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          schedule?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          schedule?: Json
          user_id?: string
        }
        Relationships: []
      }
      weekly_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          notes: string | null
          title: string
          user_id: string
          workout_id: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          notes?: string | null
          title: string
          user_id: string
          workout_id?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          notes?: string | null
          title?: string
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedules_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          completed_at: string
          exercise_name: string
          id: string
          reps: number | null
          sets: number | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["plan_source"]
          user_id: string
          weight: number | null
        }
        Insert: {
          completed_at?: string
          exercise_name: string
          id?: string
          reps?: number | null
          sets?: number | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["plan_source"]
          user_id: string
          weight?: number | null
        }
        Update: {
          completed_at?: string
          exercise_name?: string
          id?: string
          reps?: number | null
          sets?: number | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["plan_source"]
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"]
          created_at: string
          description: string | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          exercises: Json
          goal: Database["public"]["Enums"]["fitness_goal"]
          id: string
          image_url: string | null
          is_public: boolean
          min_frequency: number
          name: string
          owner_user_id: string | null
          trainer_id: string | null
        }
        Insert: {
          activity_level: Database["public"]["Enums"]["activity_level"]
          created_at?: string
          description?: string | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          exercises?: Json
          goal: Database["public"]["Enums"]["fitness_goal"]
          id?: string
          image_url?: string | null
          is_public?: boolean
          min_frequency?: number
          name: string
          owner_user_id?: string | null
          trainer_id?: string | null
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"]
          created_at?: string
          description?: string | null
          equipment?: Database["public"]["Enums"]["equipment_type"]
          exercises?: Json
          goal?: Database["public"]["Enums"]["fitness_goal"]
          id?: string
          image_url?: string | null
          is_public?: boolean
          min_frequency?: number
          name?: string
          owner_user_id?: string | null
          trainer_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_initial_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
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
      activity_level: "sedentary" | "light" | "moderate" | "high"
      app_role: "user" | "trainer"
      equipment_type: "home" | "gym" | "none"
      fitness_goal: "lose_weight" | "gain_muscle" | "fitness" | "tone"
      plan_source: "trainer" | "personal"
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
      activity_level: ["sedentary", "light", "moderate", "high"],
      app_role: ["user", "trainer"],
      equipment_type: ["home", "gym", "none"],
      fitness_goal: ["lose_weight", "gain_muscle", "fitness", "tone"],
      plan_source: ["trainer", "personal"],
    },
  },
} as const
