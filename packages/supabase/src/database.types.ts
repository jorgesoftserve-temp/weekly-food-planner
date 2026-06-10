export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      enum_metadata: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          enum_type: string
          is_official: boolean
          is_pending: boolean
          suggested_by: string | null
          updated_at: string
          usage_count: number
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          enum_type: string
          is_official: boolean
          is_pending?: boolean
          suggested_by?: string | null
          updated_at?: string
          usage_count?: number
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          enum_type?: string
          is_official?: boolean
          is_pending?: boolean
          suggested_by?: string | null
          updated_at?: string
          usage_count?: number
          value?: string
        }
        Relationships: []
      }
      generation_runs: {
        Row: {
          error_payload: Json | null
          finished_at: string | null
          id: string
          inputs_hash: string
          menu_id: string | null
          seed: number
          started_at: string
          status: Database["public"]["Enums"]["generation_status"]
          workspace_id: string
        }
        Insert: {
          error_payload?: Json | null
          finished_at?: string | null
          id?: string
          inputs_hash: string
          menu_id?: string | null
          seed: number
          started_at?: string
          status: Database["public"]["Enums"]["generation_status"]
          workspace_id: string
        }
        Update: {
          error_payload?: Json | null
          finished_at?: string | null
          id?: string
          inputs_hash?: string
          menu_id?: string | null
          seed?: number
          started_at?: string
          status?: Database["public"]["Enums"]["generation_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_runs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_items: {
        Row: {
          id: string
          ingredient_id: string
          list_id: string
          quantity: number
          scheduled_purchase_day:
            | Database["public"]["Enums"]["day_of_week"]
            | null
          unit: Database["public"]["Enums"]["unit"]
        }
        Insert: {
          id?: string
          ingredient_id: string
          list_id: string
          quantity: number
          scheduled_purchase_day?:
            | Database["public"]["Enums"]["day_of_week"]
            | null
          unit: Database["public"]["Enums"]["unit"]
        }
        Update: {
          id?: string
          ingredient_id?: string
          list_id?: string
          quantity?: number
          scheduled_purchase_day?:
            | Database["public"]["Enums"]["day_of_week"]
            | null
          unit?: Database["public"]["Enums"]["unit"]
        }
        Relationships: [
          {
            foreignKeyName: "grocery_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "grocery_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_lists: {
        Row: {
          id: string
          menu_id: string
          target_member_id: string | null
        }
        Insert: {
          id?: string
          menu_id: string
          target_member_id?: string | null
        }
        Update: {
          id?: string
          menu_id?: string
          target_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grocery_lists_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_lists_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_allergens: {
        Row: {
          allergy: string
          ingredient_id: string
        }
        Insert: {
          allergy: string
          ingredient_id: string
        }
        Update: {
          allergy?: string
          ingredient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_allergens_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_perishable: boolean
          max_storage_days: number | null
          name: string
          requires_fresh: boolean
          same_day_cook: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_perishable?: boolean
          max_storage_days?: number | null
          name: string
          requires_fresh?: boolean
          same_day_cook?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_perishable?: boolean
          max_storage_days?: number | null
          name?: string
          requires_fresh?: boolean
          same_day_cook?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      member_allergies: {
        Row: {
          allergy: string
          member_id: string
        }
        Insert: {
          allergy: string
          member_id: string
        }
        Update: {
          allergy?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_allergies_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_dietary_restrictions: {
        Row: {
          member_id: string
          restriction: string
        }
        Insert: {
          member_id: string
          restriction: string
        }
        Update: {
          member_id?: string
          restriction?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_dietary_restrictions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_ingredient_dislikes: {
        Row: {
          ingredient_id: string
          member_id: string
        }
        Insert: {
          ingredient_id: string
          member_id: string
        }
        Update: {
          ingredient_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_ingredient_dislikes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ingredient_dislikes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_participants: {
        Row: {
          member_id: string
          menu_id: string
        }
        Insert: {
          member_id: string
          menu_id: string
        }
        Update: {
          member_id?: string
          menu_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_participants_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_slots: {
        Row: {
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          id: string
          is_overridden: boolean
          meal_key: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          menu_id: string
          original_recipe_id: string | null
          recipe_id: string
          target_member_id: string | null
        }
        Insert: {
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          id?: string
          is_overridden?: boolean
          meal_key: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          menu_id: string
          original_recipe_id?: string | null
          recipe_id: string
          target_member_id?: string | null
        }
        Update: {
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          id?: string
          is_overridden?: boolean
          meal_key?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          menu_id?: string
          original_recipe_id?: string | null
          recipe_id?: string
          target_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_slots_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_slots_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_slots_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          accepted_at: string | null
          accepted_seed: string | null
          cloned_from_menu_id: string | null
          created_at: string
          duration_days: number
          generated_at: string
          generation_options: Json | null
          id: string
          inputs_hash: string | null
          is_deleted: boolean
          menu_type: Database["public"]["Enums"]["menu_type"]
          seed: number | null
          start_day_of_week: Database["public"]["Enums"]["day_of_week"]
          updated_at: string
          week_start_date: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_seed?: string | null
          cloned_from_menu_id?: string | null
          created_at?: string
          duration_days?: number
          generated_at?: string
          generation_options?: Json | null
          id?: string
          inputs_hash?: string | null
          is_deleted?: boolean
          menu_type?: Database["public"]["Enums"]["menu_type"]
          seed?: number | null
          start_day_of_week?: Database["public"]["Enums"]["day_of_week"]
          updated_at?: string
          week_start_date: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_seed?: string | null
          cloned_from_menu_id?: string | null
          created_at?: string
          duration_days?: number
          generated_at?: string
          generation_options?: Json | null
          id?: string
          inputs_hash?: string | null
          is_deleted?: boolean
          menu_type?: Database["public"]["Enums"]["menu_type"]
          seed?: number | null
          start_day_of_week?: Database["public"]["Enums"]["day_of_week"]
          updated_at?: string
          week_start_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_cloned_from_menu_id_fkey"
            columns: ["cloned_from_menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: Database["public"]["Enums"]["accent_color"]
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          accent_color?: Database["public"]["Enums"]["accent_color"]
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          accent_color?: Database["public"]["Enums"]["accent_color"]
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_dietary_tags: {
        Row: {
          recipe_id: string
          tag: string
        }
        Insert: {
          recipe_id: string
          tag: string
        }
        Update: {
          recipe_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_dietary_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          is_perishable_override: boolean | null
          quantity: number
          recipe_id: string
          substitutions: Json
          unit: Database["public"]["Enums"]["unit"]
        }
        Insert: {
          id?: string
          ingredient_id: string
          is_perishable_override?: boolean | null
          quantity: number
          recipe_id: string
          substitutions?: Json
          unit: Database["public"]["Enums"]["unit"]
        }
        Update: {
          id?: string
          ingredient_id?: string
          is_perishable_override?: boolean | null
          quantity?: number
          recipe_id?: string
          substitutions?: Json
          unit?: Database["public"]["Enums"]["unit"]
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_instructions: {
        Row: {
          description: string
          duration_minutes: number | null
          id: string
          notes: string | null
          recipe_id: string
          step_order: number
        }
        Insert: {
          description: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          recipe_id: string
          step_order: number
        }
        Update: {
          description?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          recipe_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_instructions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          calories_per_serving: number | null
          cook_time_minutes: number | null
          created_at: string
          cuisine: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty"]
          id: string
          image_url: string | null
          is_deleted: boolean
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          prep_time_minutes: number | null
          servings: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          calories_per_serving?: number | null
          cook_time_minutes?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          difficulty: Database["public"]["Enums"]["difficulty"]
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          prep_time_minutes?: number | null
          servings: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          calories_per_serving?: number | null
          cook_time_minutes?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty"]
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string
          prep_time_minutes?: number | null
          servings?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accent_color: Database["public"]["Enums"]["accent_color"] | null
          age_category: Database["public"]["Enums"]["age_category"]
          created_at: string
          daily_calorie_target: number | null
          id: string
          is_deleted: boolean
          meal_frequency: Json | null
          name: string
          role: Database["public"]["Enums"]["workspace_role"]
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          accent_color?: Database["public"]["Enums"]["accent_color"] | null
          age_category: Database["public"]["Enums"]["age_category"]
          created_at?: string
          daily_calorie_target?: number | null
          id?: string
          is_deleted?: boolean
          meal_frequency?: Json | null
          name: string
          role: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          accent_color?: Database["public"]["Enums"]["accent_color"] | null
          age_category?: Database["public"]["Enums"]["age_category"]
          created_at?: string
          daily_calorie_target?: number | null
          id?: string
          is_deleted?: boolean
          meal_frequency?: Json | null
          name?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean
          name: string
          owner_id: string
          shared_meal_frequency: Json | null
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          name: string
          owner_id: string
          shared_meal_frequency?: Json | null
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          name?: string
          owner_id?: string
          shared_meal_frequency?: Json | null
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_default_meal_frequency_for_age: {
        Args: { p_age: Database["public"]["Enums"]["age_category"] }
        Returns: Json
      }
      fn_increment_enum_metadata_usage: {
        Args: { p_enum_type: string; p_value: string }
        Returns: undefined
      }
      fn_user_workspace_role: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sys_delete_enum_suggestion: {
        Args: { p_enum_type: string; p_value: string }
        Returns: number
      }
      sys_save_label: {
        Args: { p_enum_type: string; p_value: string }
        Returns: string
      }
    }
    Enums: {
      accent_color: "strawberry" | "moss" | "teal" | "amber" | "ocean" | "plum"
      age_category: "infant" | "toddler" | "child" | "teen" | "adult" | "senior"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      difficulty: "easy" | "medium" | "hard"
      generation_status: "pending" | "running" | "success" | "failed"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      menu_type: "weekly" | "custom"
      unit:
        | "g"
        | "kg"
        | "ml"
        | "l"
        | "tsp"
        | "tbsp"
        | "cup"
        | "piece"
        | "slice"
        | "pinch"
        | "clove"
        | "can"
        | "pack"
      workspace_role: "creator" | "admin" | "member"
      workspace_type: "individual" | "group"
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
      accent_color: ["strawberry", "moss", "teal", "amber", "ocean", "plum"],
      age_category: ["infant", "toddler", "child", "teen", "adult", "senior"],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      difficulty: ["easy", "medium", "hard"],
      generation_status: ["pending", "running", "success", "failed"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      menu_type: ["weekly", "custom"],
      unit: [
        "g",
        "kg",
        "ml",
        "l",
        "tsp",
        "tbsp",
        "cup",
        "piece",
        "slice",
        "pinch",
        "clove",
        "can",
        "pack",
      ],
      workspace_role: ["creator", "admin", "member"],
      workspace_type: ["individual", "group"],
    },
  },
} as const

