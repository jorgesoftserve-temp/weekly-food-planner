import type { SupabaseClient } from '@supabase/supabase-js'
import type { FoodGroupSource } from '../types/db.js'

export type IngredientRecord = {
  id: string
  name: string
  is_perishable: boolean
  max_storage_days: number | null
  requires_fresh: boolean
  same_day_cook: boolean
  image_url: string | null
  /** Extensible label from the food_group set. NULL until classified. See DATABASE_PRD §5.2 (v2.0). */
  food_group: string | null
  /** Tracks how the food_group value was assigned. See DATABASE_PRD §5.1 (v2.0). */
  food_group_source: FoodGroupSource
  ingredient_allergens: Array<{ allergy: string }>
}

export const ingredientQueryKeys = {
  list: ['ingredients', 'list'] as const,
}

export const ingredientKeys = {
  list: () => ['ingredients', 'list'] as const,
}

export const listIngredients = async ({
  supabase,
}: {
  supabase: SupabaseClient
}): Promise<IngredientRecord[]> => {
  const { data, error } = await supabase
    .from('ingredients')
    .select(
      `id, name, is_perishable, max_storage_days, requires_fresh, same_day_cook, image_url, food_group, food_group_source,
       ingredient_allergens (allergy)`,
    )
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as IngredientRecord[]
}

export type CreateIngredientPayload = {
  name: string
  isPerishable?: boolean
  maxStorageDays?: number | null
  requiresFresh?: boolean
  sameDayCook?: boolean
  allergens?: string[]
  /** Extensible label from the food_group set. Route must call sys_save_label('food_group', value) before passing. */
  foodGroup?: string | null
  /** How the food_group was determined. Defaults to 'unset' when omitted. */
  foodGroupSource?: FoodGroupSource
}

export type UpdateIngredientPatch = {
  /** Extensible label from the food_group set. Route must call sys_save_label('food_group', value) before passing. */
  foodGroup?: string | null
  /** How the food_group was determined. */
  foodGroupSource?: FoodGroupSource
}

// Inserts a new row into the global ingredients catalog plus any allergen
// mappings. RLS on `ingredients` blocks INSERT for `authenticated` (catalog is
// service-managed per DATABASE_PRD §8) — callers must pass a service-role
// client. The API route enforces auth before reaching this.
export const createIngredient = async ({
  admin,
  payload,
}: {
  admin: SupabaseClient
  payload: CreateIngredientPayload
}): Promise<IngredientRecord> => {
  const trimmedName = payload.name.trim()
  if (trimmedName.length === 0) throw new Error('name is required')

  const { data: insertedRow, error: insErr } = await admin
    .from('ingredients')
    .insert({
      name: trimmedName,
      is_perishable: payload.isPerishable ?? false,
      max_storage_days: payload.maxStorageDays ?? null,
      requires_fresh: payload.requiresFresh ?? false,
      same_day_cook: payload.sameDayCook ?? false,
      food_group: payload.foodGroup ?? null,
      food_group_source: payload.foodGroupSource ?? 'unset',
    })
    .select('id')
    .single()
  if (insErr || !insertedRow) {
    throw new Error(insErr?.message ?? 'failed to insert ingredient')
  }
  const ingredientId = (insertedRow as { id: string }).id

  const allergens = (payload.allergens ?? [])
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
  if (allergens.length > 0) {
    const { error: allErr } = await admin.from('ingredient_allergens').insert(
      allergens.map((allergy) => ({ ingredient_id: ingredientId, allergy })),
    )
    if (allErr) throw new Error(allErr.message)
  }

  // Re-fetch with allergen join so the response matches IngredientRecord shape
  // exactly — clients can stitch the returned row into their cache directly.
  const { data: fullRow, error: getErr } = await admin
    .from('ingredients')
    .select(
      `id, name, is_perishable, max_storage_days, requires_fresh, same_day_cook, image_url, food_group, food_group_source,
       ingredient_allergens (allergy)`,
    )
    .eq('id', ingredientId)
    .single()
  if (getErr || !fullRow) {
    throw new Error(getErr?.message ?? 'inserted but failed to refetch')
  }
  return fullRow as unknown as IngredientRecord
}

// Updates the food_group and food_group_source on an existing ingredient row.
// Used by the admin seeding route (source='seed') and the Claude-API classifier
// (source='ai') to cache the classification result on the row server-side.
// Callers must pass a service-role client — RLS blocks ingredient writes for
// authenticated users (catalog is service-managed per DATABASE_PRD §8).
// The route must call sys_save_label('food_group', value) before this to ensure
// the value is registered in enum_metadata.
export const updateIngredientFoodGroup = async ({
  admin,
  ingredientId,
  patch,
}: {
  admin: SupabaseClient
  ingredientId: string
  patch: UpdateIngredientPatch
}): Promise<void> => {
  const update: Record<string, unknown> = {}
  if (patch.foodGroup !== undefined) update.food_group = patch.foodGroup
  if (patch.foodGroupSource !== undefined) update.food_group_source = patch.foodGroupSource

  if (Object.keys(update).length === 0) return

  const { error } = await admin
    .from('ingredients')
    .update(update)
    .eq('id', ingredientId)
  if (error) throw new Error(error.message)
}
