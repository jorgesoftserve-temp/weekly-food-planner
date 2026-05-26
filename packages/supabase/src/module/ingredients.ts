import type { SupabaseClient } from '@supabase/supabase-js'

export type IngredientRecord = {
  id: string
  name: string
  is_perishable: boolean
  max_storage_days: number | null
  requires_fresh: boolean
  same_day_cook: boolean
  image_url: string | null
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
      `id, name, is_perishable, max_storage_days, requires_fresh, same_day_cook, image_url,
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
      `id, name, is_perishable, max_storage_days, requires_fresh, same_day_cook, image_url,
       ingredient_allergens (allergy)`,
    )
    .eq('id', ingredientId)
    .single()
  if (getErr || !fullRow) {
    throw new Error(getErr?.message ?? 'inserted but failed to refetch')
  }
  return fullRow as unknown as IngredientRecord
}
