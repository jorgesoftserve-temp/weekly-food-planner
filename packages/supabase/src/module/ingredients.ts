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
