// Local DB-shaped types. Will be replaced by `pnpm db:gen:types` output once the
// local stack is up and `supabase gen types typescript` writes
// `src/database.types.ts`. Until then these mirror DATABASE_PRD enums.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type AgeCategory = 'infant' | 'toddler' | 'child' | 'teen' | 'adult' | 'senior'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type WorkspaceRole = 'creator' | 'admin' | 'member'
export type WorkspaceType = 'individual' | 'group'
export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'piece'
  | 'slice'
  | 'pinch'
  | 'clove'
  | 'can'
  | 'pack'

export type WorkspaceRow = {
  id: string
  type: WorkspaceType
  name: string
  shared_meal_frequency: unknown
  owner_id: string
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type WorkspaceMemberRow = {
  id: string
  workspace_id: string
  user_id: string | null
  name: string
  role: WorkspaceRole
  age_category: AgeCategory
  daily_calorie_target: number | null
  meal_frequency: unknown
  is_deleted: boolean
}

export type RecipeRow = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  image_url: string | null
  meal_type: MealType
  cuisine: string | null
  difficulty: Difficulty
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  calories_per_serving: number | null
  is_deleted: boolean
}

export type RecipeIngredientRow = {
  id: string
  recipe_id: string
  ingredient_id: string
  quantity: string | number
  unit: Unit
  substitutions: unknown
  is_perishable_override: boolean | null
}

export type RecipeInstructionRow = {
  id: string
  recipe_id: string
  step_order: number
  description: string
  notes: string | null
  duration_minutes: number | null
}

export type IngredientRow = {
  id: string
  name: string
  is_perishable: boolean
  max_storage_days: number | null
  requires_fresh: boolean
  same_day_cook: boolean
  image_url: string | null
}

export type MenuRow = {
  id: string
  workspace_id: string
  week_start_date: string
  seed: number
  inputs_hash: string
  is_deleted: boolean
  created_at: string
}

export type MenuSlotRow = {
  id: string
  menu_id: string
  day_of_week: string
  meal_key: string
  meal_type: MealType
  recipe_id: string
  target_member_id: string | null
}

export type GroceryListRow = {
  id: string
  menu_id: string
  target_member_id: string | null
}

export type GroceryItemRow = {
  id: string
  grocery_list_id: string
  ingredient_id: string
  quantity: string | number
  unit: Unit
  scheduled_purchase_day: string | null
}

export type EnumMetadataRow = {
  id: string
  enum_type: string
  value: string
  is_official: boolean
  usage_count: number
}
