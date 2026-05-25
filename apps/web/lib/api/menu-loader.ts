import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AgeCategory,
  Difficulty,
  IngredientSnapshot,
  MealFrequencyEntry,
  MealType,
  MemberSnapshot,
  RecipeSnapshot,
  Unit,
  WorkspaceRole,
  WorkspaceSnapshot,
} from '@weekly-food-planner/constraint-engine'

// Local row types. Replace with generated database.types.ts once `supabase
// gen types` has been run against the local instance.

type WorkspaceRow = {
  id: string
  type: 'individual' | 'group'
  name: string
  shared_meal_frequency: unknown
}

type MemberRow = {
  id: string
  name: string
  role: WorkspaceRole
  age_category: AgeCategory
  daily_calorie_target: number | null
  meal_frequency: unknown
  member_dietary_restrictions: Array<{ restriction: string }>
  member_allergies: Array<{ allergy: string }>
  member_ingredient_dislikes: Array<{ ingredient_id: string }>
}

type RecipeRow = {
  id: string
  name: string
  description: string | null
  meal_type: MealType
  cuisine: string | null
  difficulty: Difficulty
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  calories_per_serving: number | null
  recipe_ingredients: Array<{
    ingredient_id: string
    quantity: string | number
    unit: Unit
    substitutions: unknown
    is_perishable_override: boolean | null
  }>
  recipe_dietary_tags: Array<{ tag: string }>
}

type IngredientRow = {
  id: string
  name: string
  is_perishable: boolean
  max_storage_days: number | null
  requires_fresh: boolean
  same_day_cook: boolean
  ingredient_allergens: Array<{ allergy: string }>
}

export type LoadSnapshotResult =
  | {
      ok: true
      workspace: WorkspaceSnapshot
      members: MemberSnapshot[]
      recipes: RecipeSnapshot[]
      ingredients: IngredientSnapshot[]
    }
  | { ok: false; reason: 'workspace_not_found' | 'no_recipes' | 'db_error'; detail?: string }

const parseMealFrequency = (raw: unknown): MealFrequencyEntry[] | undefined => {
  if (!raw || !Array.isArray(raw)) return undefined
  return raw as MealFrequencyEntry[]
}

const parseSubstitutions = (raw: unknown): Array<{ ingredientId: string; note?: string }> => {
  if (!raw || !Array.isArray(raw)) return []
  return raw as Array<{ ingredientId: string; note?: string }>
}

export const loadEngineSnapshot = async ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<LoadSnapshotResult> => {
  const { data: workspaceData, error: wsErr } = await supabase
    .from('workspaces')
    .select('id, type, name, shared_meal_frequency')
    .eq('id', workspaceId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (wsErr) return { ok: false, reason: 'db_error', detail: wsErr.message }
  if (!workspaceData) return { ok: false, reason: 'workspace_not_found' }
  const workspaceRow = workspaceData as WorkspaceRow
  const workspace: WorkspaceSnapshot = {
    id: workspaceRow.id,
    type: workspaceRow.type,
    name: workspaceRow.name,
    sharedMealFrequency: parseMealFrequency(workspaceRow.shared_meal_frequency),
  }

  const { data: memberData, error: memErr } = await supabase
    .from('workspace_members')
    .select(
      `id, name, role, age_category, daily_calorie_target, meal_frequency,
       member_dietary_restrictions (restriction),
       member_allergies (allergy),
       member_ingredient_dislikes (ingredient_id)`,
    )
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
  if (memErr) return { ok: false, reason: 'db_error', detail: memErr.message }
  const memberRows = (memberData ?? []) as unknown as MemberRow[]
  const members: MemberSnapshot[] = memberRows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    ageCategory: row.age_category,
    dailyCalorieTarget: row.daily_calorie_target ?? undefined,
    mealFrequency: parseMealFrequency(row.meal_frequency),
    dietaryRestrictions: row.member_dietary_restrictions.map((r) => r.restriction),
    allergies: row.member_allergies.map((a) => a.allergy),
    ingredientDislikes: row.member_ingredient_dislikes.map((d) => d.ingredient_id),
  }))

  const { data: recipeData, error: recErr } = await supabase
    .from('recipes')
    .select(
      `id, name, description, meal_type, cuisine, difficulty,
       prep_time_minutes, cook_time_minutes, servings, calories_per_serving,
       recipe_ingredients (ingredient_id, quantity, unit, substitutions, is_perishable_override),
       recipe_dietary_tags (tag)`,
    )
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
  if (recErr) return { ok: false, reason: 'db_error', detail: recErr.message }
  const recipeRows = (recipeData ?? []) as unknown as RecipeRow[]
  if (recipeRows.length === 0) return { ok: false, reason: 'no_recipes' }
  const recipes: RecipeSnapshot[] = recipeRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    mealType: row.meal_type,
    cuisine: row.cuisine ?? undefined,
    difficulty: row.difficulty,
    prepTimeMinutes: row.prep_time_minutes ?? undefined,
    cookTimeMinutes: row.cook_time_minutes ?? undefined,
    servings: row.servings,
    caloriesPerServing: row.calories_per_serving ?? undefined,
    ingredients: row.recipe_ingredients.map((ri) => ({
      ingredientId: ri.ingredient_id,
      quantity: typeof ri.quantity === 'string' ? parseFloat(ri.quantity) : ri.quantity,
      unit: ri.unit,
      substitutions: parseSubstitutions(ri.substitutions),
      isPerishableOverride: ri.is_perishable_override,
    })),
    dietaryTags: row.recipe_dietary_tags.map((t) => t.tag),
  }))

  const { data: ingredientData, error: ingErr } = await supabase
    .from('ingredients')
    .select(
      `id, name, is_perishable, max_storage_days, requires_fresh, same_day_cook,
       ingredient_allergens (allergy)`,
    )
  if (ingErr) return { ok: false, reason: 'db_error', detail: ingErr.message }
  const ingredientRows = (ingredientData ?? []) as unknown as IngredientRow[]
  const ingredients: IngredientSnapshot[] = ingredientRows.map((row) => ({
    id: row.id,
    name: row.name,
    isPerishable: row.is_perishable,
    maxStorageDays: row.max_storage_days,
    requiresFresh: row.requires_fresh,
    sameDayCook: row.same_day_cook,
    allergens: row.ingredient_allergens.map((a) => a.allergy),
  }))

  return { ok: true, workspace, members, recipes, ingredients }
}
