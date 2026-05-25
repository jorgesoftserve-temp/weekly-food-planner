import { type NextRequest } from 'next/server'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import { isValidAdminKey } from '@/lib/api/admin-key'
import { forbidden, jsonOk, serverError } from '@/lib/api/responses'

type SeedIngredient = {
  name: string
  isPerishable?: boolean
  maxStorageDays?: number
  requiresFresh?: boolean
  sameDayCook?: boolean
  allergens?: string[]
}

// Compact starter catalog covering most common allergen classes so the engine
// can be exercised end-to-end without manual ingredient setup. Idempotent
// upsert on ingredients.name.
const SEED_INGREDIENTS: ReadonlyArray<SeedIngredient> = [
  { name: 'Chicken breast', isPerishable: true, maxStorageDays: 3, requiresFresh: true },
  { name: 'Beef mince', isPerishable: true, maxStorageDays: 2, requiresFresh: true },
  { name: 'Salmon fillet', isPerishable: true, maxStorageDays: 1, requiresFresh: true, sameDayCook: true, allergens: ['fish'] },
  { name: 'Eggs', isPerishable: true, maxStorageDays: 21, allergens: ['egg'] },
  { name: 'Milk', isPerishable: true, maxStorageDays: 7, allergens: ['dairy'] },
  { name: 'Greek yogurt', isPerishable: true, maxStorageDays: 14, allergens: ['dairy'] },
  { name: 'Cheddar cheese', isPerishable: true, maxStorageDays: 21, allergens: ['dairy'] },
  { name: 'Butter', isPerishable: true, maxStorageDays: 60, allergens: ['dairy'] },
  { name: 'Tofu', isPerishable: true, maxStorageDays: 7, allergens: ['soy'] },
  { name: 'Tempeh', isPerishable: true, maxStorageDays: 14, allergens: ['soy'] },
  { name: 'Whole wheat bread', isPerishable: true, maxStorageDays: 7, allergens: ['gluten'] },
  { name: 'Pasta', maxStorageDays: 365, allergens: ['gluten'] },
  { name: 'Rice', maxStorageDays: 365 },
  { name: 'Quinoa', maxStorageDays: 365 },
  { name: 'Oats', maxStorageDays: 365 },
  { name: 'Olive oil', maxStorageDays: 365 },
  { name: 'Garlic', maxStorageDays: 30 },
  { name: 'Onion', maxStorageDays: 30 },
  { name: 'Tomato', isPerishable: true, maxStorageDays: 7 },
  { name: 'Spinach', isPerishable: true, maxStorageDays: 5, requiresFresh: true },
  { name: 'Carrot', maxStorageDays: 21 },
  { name: 'Lemon', maxStorageDays: 21 },
  { name: 'Avocado', isPerishable: true, maxStorageDays: 5, requiresFresh: true },
  { name: 'Black beans', maxStorageDays: 365 },
  { name: 'Chickpeas', maxStorageDays: 365 },
  { name: 'Peanut butter', maxStorageDays: 365, allergens: ['peanut'] },
  { name: 'Almonds', maxStorageDays: 180, allergens: ['tree_nut'] },
  { name: 'Shrimp', isPerishable: true, maxStorageDays: 1, requiresFresh: true, sameDayCook: true, allergens: ['shellfish'] },
  { name: 'Sesame oil', maxStorageDays: 365, allergens: ['sesame'] },
  { name: 'Soy sauce', maxStorageDays: 365, allergens: ['soy'] },
]

export const POST = async (request: NextRequest) => {
  if (!isValidAdminKey({ request })) return forbidden()

  const admin = supabaseAdminClient()
  const upserts = SEED_INGREDIENTS.map((ingredient) => ({
    name: ingredient.name,
    is_perishable: ingredient.isPerishable ?? false,
    max_storage_days: ingredient.maxStorageDays ?? null,
    requires_fresh: ingredient.requiresFresh ?? false,
    same_day_cook: ingredient.sameDayCook ?? false,
  }))

  const { data: insertedIngredients, error: ingErr } = await admin
    .from('ingredients')
    .upsert(upserts, { onConflict: 'name' })
    .select('id, name')

  if (ingErr) return serverError(ingErr.message)

  const nameToId = new Map<string, string>()
  for (const row of insertedIngredients ?? []) {
    nameToId.set(row.name as string, row.id as string)
  }

  const allergenRows: Array<{ ingredient_id: string; allergy: string }> = []
  for (const ingredient of SEED_INGREDIENTS) {
    const id = nameToId.get(ingredient.name)
    if (!id || !ingredient.allergens) continue
    for (const allergen of ingredient.allergens) {
      allergenRows.push({ ingredient_id: id, allergy: allergen })
    }
  }

  if (allergenRows.length > 0) {
    const { error: allErr } = await admin
      .from('ingredient_allergens')
      .upsert(allergenRows, { onConflict: 'ingredient_id,allergy' })
    if (allErr) return serverError(allErr.message)
  }

  return jsonOk({
    seeded: {
      ingredients: insertedIngredients?.length ?? 0,
      allergens: allergenRows.length,
    },
  })
}
