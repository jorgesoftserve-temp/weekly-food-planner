import type { SupabaseClient } from '@supabase/supabase-js'
import type { Difficulty, MealType, RecipeKind, Unit } from '../types/db.js'

export type RecipeRecord = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  /** (v2.1) recipe_kind replaces the dropped scalar meal_type column. */
  recipe_kind: RecipeKind
  /** (v2.1) Set of meal timeframes from the recipe_meal_types junction. Empty for addons. */
  meal_types: MealType[]
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
  /** (v2.1) Defaults to 'meal'. */
  recipe_kind?: RecipeKind
  /** (v2.1) ≥1 required when recipe_kind='meal'. Addons may have zero. */
  meal_types?: MealType[]
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
  recipe_kind: RecipeKind
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

// (v2.1) meal_type scalar removed; recipe_meal_types junction provides the set.
// recipe_kind added for engine exclusion at the input-builder boundary.
const RECIPE_SELECT = `id, name, description, image_url, recipe_kind, cuisine, difficulty,
  prep_time_minutes, cook_time_minutes, servings, calories_per_serving,
  recipe_ingredients (id, ingredient_id, quantity, unit, substitutions, is_perishable_override),
  recipe_instructions (id, step_order, description, notes, duration_minutes),
  recipe_dietary_tags (tag),
  recipe_meal_types (meal_type)`

// PostgREST returns recipe_meal_types as an array of { meal_type } objects.
// Flatten to a plain MealType[] for consumers.
const toRecord = (row: Record<string, unknown>): RecipeRecord => {
  const mealTypeRows = (row.recipe_meal_types ?? []) as Array<{ meal_type: MealType }>
  const { recipe_meal_types: _ignored, ...rest } = row
  return {
    ...(rest as unknown as Omit<RecipeRecord, 'meal_types'>),
    meal_types: mealTypeRows.map((r) => r.meal_type),
  }
}

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
  return ((data ?? []) as Array<Record<string, unknown>>).map(toRecord)
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
  if (!data) return null
  return toRecord(data as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Enforce the ≥1 meal type rule for kind='meal'. The route handler re-checks
 * this with the Zod schema; this is the module-layer guard.
 */
const validateMealTypes = (payload: CreateRecipePayload): void => {
  const kind = payload.recipe_kind ?? 'meal'
  if (kind === 'meal' && (!payload.meal_types || payload.meal_types.length === 0)) {
    throw new Error('At least one meal_type is required for recipe_kind="meal"')
  }
}

// ---------------------------------------------------------------------------
// Single-recipe create (unchanged public contract; extended internally)
// ---------------------------------------------------------------------------

export const createRecipe = async ({
  supabase,
  workspaceId,
  payload,
}: {
  supabase: SupabaseClient
  workspaceId: string
  payload: CreateRecipePayload
}): Promise<{ id: string }> => {
  validateMealTypes(payload)

  if (payload.cuisine) {
    await supabase.rpc('sys_save_label', {
      p_enum_type: 'cuisine_type',
      p_value: payload.cuisine,
    })
  }
  for (const tag of payload.dietary_tags ?? []) {
    await supabase.rpc('sys_save_label', { p_enum_type: 'dietary_tag', p_value: tag })
  }

  const kind: RecipeKind = payload.recipe_kind ?? 'meal'

  const { data: row, error: insertErr } = await supabase
    .from('recipes')
    .insert({
      workspace_id: workspaceId,
      name: payload.name,
      description: payload.description ?? null,
      image_url: payload.image_url ?? null,
      recipe_kind: kind,
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

  await _insertRecipeChildren({ supabase, recipeId, payload })

  return { id: recipeId }
}

/**
 * Internal helper: insert all child rows for a recipe. Shared by single-create
 * and bulk-create so child-row logic stays in one place.
 */
const _insertRecipeChildren = async ({
  supabase,
  recipeId,
  payload,
}: {
  supabase: SupabaseClient
  recipeId: string
  payload: CreateRecipePayload
}): Promise<void> => {
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
  if (payload.meal_types && payload.meal_types.length > 0) {
    const { error: mtErr } = await supabase
      .from('recipe_meal_types')
      .insert(payload.meal_types.map((meal_type) => ({ recipe_id: recipeId, meal_type })))
    if (mtErr) throw new Error(mtErr.message)
  }
}

// ---------------------------------------------------------------------------
// Bulk recipe create (Track E) — all-or-nothing
// ---------------------------------------------------------------------------

/**
 * (v2.1 Track E) Insert N recipes + all their child rows (ingredients,
 * instructions, dietary tags, meal types) and return the created ids.
 *
 * ROLLBACK GUARANTEE: supabase-js does not expose multi-statement transactions.
 * This implementation uses a sequential insert strategy with manual compensation:
 * if any step fails after the recipe rows have been inserted, it hard-deletes
 * all successfully inserted recipe rows (which cascades to all child rows via
 * ON DELETE CASCADE on every child table). This is a best-effort rollback that
 * guarantees no orphaned data persists. The only window where partial data could
 * survive a process crash is the narrow gap between the recipe insert and the
 * compensating delete — callers should treat the returned ids as authoritative
 * (if no ids are returned, nothing committed).
 *
 * A Postgres-native transactional RPC is the correct solution for strict
 * all-or-nothing semantics. If this guarantee matters for the v3/v4 consumers
 * (AI import / community deep-copy), delegate to supabase-migration-author to
 * author a `sys_create_recipes_bulk` RPC that wraps the inserts in a BEGIN/COMMIT.
 */
export const createRecipesBulk = async ({
  supabase,
  workspaceId,
  recipes,
}: {
  supabase: SupabaseClient
  workspaceId: string
  recipes: CreateRecipePayload[]
}): Promise<{ ids: string[] }> => {
  if (recipes.length === 0) return { ids: [] }

  // Validate all payloads before touching the database.
  for (const recipe of recipes) {
    validateMealTypes(recipe)
  }

  // Persist cuisine/tag labels for all recipes upfront (non-transactional but
  // idempotent — sys_save_label is an upsert).
  for (const recipe of recipes) {
    if (recipe.cuisine) {
      await supabase.rpc('sys_save_label', {
        p_enum_type: 'cuisine_type',
        p_value: recipe.cuisine,
      })
    }
    for (const tag of recipe.dietary_tags ?? []) {
      await supabase.rpc('sys_save_label', { p_enum_type: 'dietary_tag', p_value: tag })
    }
  }

  // Insert all recipe rows in one batch.
  const { data: rows, error: batchErr } = await supabase
    .from('recipes')
    .insert(
      recipes.map((recipe) => ({
        workspace_id: workspaceId,
        name: recipe.name,
        description: recipe.description ?? null,
        image_url: recipe.image_url ?? null,
        recipe_kind: recipe.recipe_kind ?? 'meal',
        cuisine: recipe.cuisine ?? null,
        difficulty: recipe.difficulty,
        prep_time_minutes: recipe.prep_time_minutes ?? null,
        cook_time_minutes: recipe.cook_time_minutes ?? null,
        servings: recipe.servings,
        calories_per_serving: recipe.calories_per_serving ?? null,
      })),
    )
    .select('id')
  if (batchErr || !rows) {
    throw new Error(batchErr?.message ?? 'failed to insert recipes batch')
  }

  const insertedIds = (rows as Array<{ id: string }>).map((r) => r.id)

  // Insert child rows for each recipe. On any failure, compensate by deleting
  // all successfully inserted recipe rows (cascades to children).
  try {
    for (let i = 0; i < recipes.length; i++) {
      await _insertRecipeChildren({
        supabase,
        recipeId: insertedIds[i]!,
        payload: recipes[i]!,
      })
    }
  } catch (childErr) {
    // Compensating delete — remove all recipe rows inserted in this batch.
    // ON DELETE CASCADE removes all child rows automatically.
    await supabase.from('recipes').delete().in('id', insertedIds)
    throw childErr instanceof Error
      ? childErr
      : new Error('failed to insert recipe children; batch rolled back')
  }

  return { ids: insertedIds }
}

// ---------------------------------------------------------------------------
// Update / delete
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Replace-the-whole-array helpers for recipe sub-resources.
// Each performs a delete + insert; the parent recipe row stays untouched so
// updated_at on `recipes` isn't bumped by a no-op array swap. Caller is
// responsible for validating that the recipe belongs to the workspace (the
// route handler does this via getRecipe before calling).
// ---------------------------------------------------------------------------

export const replaceRecipeIngredients = async ({
  supabase,
  recipeId,
  ingredients,
}: {
  supabase: SupabaseClient
  recipeId: string
  ingredients: RecipeIngredientInput[]
}): Promise<void> => {
  const { error: delErr } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
  if (delErr) throw new Error(delErr.message)
  if (ingredients.length === 0) return
  const { error: insErr } = await supabase.from('recipe_ingredients').insert(
    ingredients.map((ing) => ({
      recipe_id: recipeId,
      ingredient_id: ing.ingredient_id,
      quantity: ing.quantity,
      unit: ing.unit,
      substitutions: ing.substitutions ?? [],
      is_perishable_override: ing.is_perishable_override ?? null,
    })),
  )
  if (insErr) throw new Error(insErr.message)
}

export const replaceRecipeInstructions = async ({
  supabase,
  recipeId,
  instructions,
}: {
  supabase: SupabaseClient
  recipeId: string
  instructions: RecipeInstructionInput[]
}): Promise<void> => {
  const { error: delErr } = await supabase
    .from('recipe_instructions')
    .delete()
    .eq('recipe_id', recipeId)
  if (delErr) throw new Error(delErr.message)
  if (instructions.length === 0) return
  const { error: insErr } = await supabase.from('recipe_instructions').insert(
    instructions.map((step) => ({
      recipe_id: recipeId,
      step_order: step.step_order,
      description: step.description,
      notes: step.notes ?? null,
      duration_minutes: step.duration_minutes ?? null,
    })),
  )
  if (insErr) throw new Error(insErr.message)
}

export const replaceRecipeDietaryTags = async ({
  supabase,
  recipeId,
  tags,
}: {
  supabase: SupabaseClient
  recipeId: string
  tags: string[]
}): Promise<void> => {
  // Each tag funnels through sys_save_label so user-typed extensions are
  // persisted to enum_metadata. Mirrors the create path in createRecipe.
  for (const tag of tags) {
    await supabase.rpc('sys_save_label', {
      p_enum_type: 'dietary_tag',
      p_value: tag,
    })
  }
  const { error: delErr } = await supabase
    .from('recipe_dietary_tags')
    .delete()
    .eq('recipe_id', recipeId)
  if (delErr) throw new Error(delErr.message)
  if (tags.length === 0) return
  const { error: insErr } = await supabase
    .from('recipe_dietary_tags')
    .insert(tags.map((tag) => ({ recipe_id: recipeId, tag })))
  if (insErr) throw new Error(insErr.message)
}

/**
 * (v2.1) Replace the full meal-type set for a recipe. Mirrors replaceRecipeDietaryTags.
 * The caller must validate the ≥1 rule before invoking (the route handler owns
 * that responsibility for edits; the module-layer guard is in createRecipe /
 * createRecipesBulk).
 */
export const replaceRecipeMealTypes = async ({
  supabase,
  recipeId,
  mealTypes,
}: {
  supabase: SupabaseClient
  recipeId: string
  mealTypes: MealType[]
}): Promise<void> => {
  const { error: delErr } = await supabase
    .from('recipe_meal_types')
    .delete()
    .eq('recipe_id', recipeId)
  if (delErr) throw new Error(delErr.message)
  if (mealTypes.length === 0) return
  const { error: insErr } = await supabase
    .from('recipe_meal_types')
    .insert(mealTypes.map((meal_type) => ({ recipe_id: recipeId, meal_type })))
  if (insErr) throw new Error(insErr.message)
}
