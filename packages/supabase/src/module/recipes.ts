import type { SupabaseClient } from '@supabase/supabase-js'
import type { Difficulty, MealType, Unit } from '../types/db.js'

export type RecipeRecord = {
  id: string
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
  recipe_ingredients: Array<{
    id: string
    ingredient_id: string
    quantity: string | number
    unit: Unit
    substitutions: unknown
    is_perishable_override: boolean | null
  }>
  recipe_instructions: Array<{
    id: string
    step_order: number
    description: string
    notes: string | null
    duration_minutes: number | null
  }>
  recipe_dietary_tags: Array<{ tag: string }>
}

export type RecipeIngredientInput = {
  ingredient_id: string
  quantity: number
  unit: Unit
  substitutions?: Array<{ ingredient_id: string; note?: string }>
  is_perishable_override?: boolean | null
}

export type RecipeInstructionInput = {
  step_order: number
  description: string
  notes?: string
  duration_minutes?: number
}

export type CreateRecipePayload = {
  name: string
  description?: string
  image_url?: string
  meal_type: MealType
  cuisine?: string
  difficulty: Difficulty
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings: number
  calories_per_serving?: number
  ingredients?: RecipeIngredientInput[]
  instructions?: RecipeInstructionInput[]
  dietary_tags?: string[]
}

export type UpdateRecipePatch = Partial<{
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
}>

export const recipeQueryKeys = {
  list: (workspaceId: string) => ['recipes', 'list', workspaceId] as const,
  detail: (workspaceId: string, recipeId: string) =>
    ['recipes', 'detail', workspaceId, recipeId] as const,
}

export const recipeKeys = {
  list: (workspaceId: string) => ['recipes', 'list', workspaceId] as const,
  detail: (workspaceId: string, recipeId: string) =>
    ['recipes', 'detail', workspaceId, recipeId] as const,
}

const RECIPE_SELECT = `id, name, description, image_url, meal_type, cuisine, difficulty,
  prep_time_minutes, cook_time_minutes, servings, calories_per_serving,
  recipe_ingredients (id, ingredient_id, quantity, unit, substitutions, is_perishable_override),
  recipe_instructions (id, step_order, description, notes, duration_minutes),
  recipe_dietary_tags (tag)`

export const listRecipes = async ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<RecipeRecord[]> => {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as RecipeRecord[]
}

export const getRecipe = async ({
  supabase,
  workspaceId,
  recipeId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
}): Promise<RecipeRecord | null> => {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', recipeId)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as RecipeRecord | null) ?? null
}

export const createRecipe = async ({
  supabase,
  workspaceId,
  payload,
}: {
  supabase: SupabaseClient
  workspaceId: string
  payload: CreateRecipePayload
}): Promise<{ id: string }> => {
  if (payload.cuisine) {
    await supabase.rpc('sys_save_label', {
      p_enum_type: 'cuisine_type',
      p_value: payload.cuisine,
    })
  }
  for (const tag of payload.dietary_tags ?? []) {
    await supabase.rpc('sys_save_label', { p_enum_type: 'dietary_tag', p_value: tag })
  }
  const { data: row, error: insertErr } = await supabase
    .from('recipes')
    .insert({
      workspace_id: workspaceId,
      name: payload.name,
      description: payload.description ?? null,
      image_url: payload.image_url ?? null,
      meal_type: payload.meal_type,
      cuisine: payload.cuisine ?? null,
      difficulty: payload.difficulty,
      prep_time_minutes: payload.prep_time_minutes ?? null,
      cook_time_minutes: payload.cook_time_minutes ?? null,
      servings: payload.servings,
      calories_per_serving: payload.calories_per_serving ?? null,
    })
    .select('id')
    .single()
  if (insertErr || !row) {
    throw new Error(insertErr?.message ?? 'failed to create recipe')
  }
  const recipeId = (row as { id: string }).id

  if (payload.ingredients && payload.ingredients.length > 0) {
    const { error: ingErr } = await supabase.from('recipe_ingredients').insert(
      payload.ingredients.map((ing) => ({
        recipe_id: recipeId,
        ingredient_id: ing.ingredient_id,
        quantity: ing.quantity,
        unit: ing.unit,
        substitutions: ing.substitutions ?? [],
        is_perishable_override: ing.is_perishable_override ?? null,
      })),
    )
    if (ingErr) throw new Error(ingErr.message)
  }
  if (payload.instructions && payload.instructions.length > 0) {
    const { error: insErr } = await supabase.from('recipe_instructions').insert(
      payload.instructions.map((step) => ({
        recipe_id: recipeId,
        step_order: step.step_order,
        description: step.description,
        notes: step.notes ?? null,
        duration_minutes: step.duration_minutes ?? null,
      })),
    )
    if (insErr) throw new Error(insErr.message)
  }
  if (payload.dietary_tags && payload.dietary_tags.length > 0) {
    const { error: tagErr } = await supabase
      .from('recipe_dietary_tags')
      .insert(payload.dietary_tags.map((tag) => ({ recipe_id: recipeId, tag })))
    if (tagErr) throw new Error(tagErr.message)
  }
  return { id: recipeId }
}

export const updateRecipe = async ({
  supabase,
  workspaceId,
  recipeId,
  patch,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
  patch: UpdateRecipePatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  if (patch.cuisine) {
    await supabase.rpc('sys_save_label', {
      p_enum_type: 'cuisine_type',
      p_value: patch.cuisine,
    })
  }
  const { error } = await supabase
    .from('recipes')
    .update(patch)
    .eq('id', recipeId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

export const softDeleteRecipe = async ({
  supabase,
  workspaceId,
  recipeId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
}): Promise<void> => {
  const { error } = await supabase
    .from('recipes')
    .update({ is_deleted: true })
    .eq('id', recipeId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}
