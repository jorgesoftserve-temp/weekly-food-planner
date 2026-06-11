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
  // One of the 10 official food_group label values registered in enum_metadata
  // by migration 20260610221508_tbl_ingredients_add_food_group_with_index.sql.
  // Valid values: vegetables | fruits | grains | proteins | dairy |
  //               fats_oils | herbs_spices | condiments | beverages | other
  foodGroup: string
}

// Compact starter catalog covering most common allergen classes so the engine
// can be exercised end-to-end without manual ingredient setup. Idempotent
// upsert on ingredients.name.
// v2.0 (Phase 0): each entry now carries food_group (source = 'seed').
const SEED_INGREDIENTS: ReadonlyArray<SeedIngredient> = [
  { name: 'Chicken breast', isPerishable: true, maxStorageDays: 3, requiresFresh: true, foodGroup: 'proteins' },
  { name: 'Beef mince', isPerishable: true, maxStorageDays: 2, requiresFresh: true, foodGroup: 'proteins' },
  { name: 'Salmon fillet', isPerishable: true, maxStorageDays: 1, requiresFresh: true, sameDayCook: true, allergens: ['fish'], foodGroup: 'proteins' },
  { name: 'Eggs', isPerishable: true, maxStorageDays: 21, allergens: ['egg'], foodGroup: 'proteins' },
  { name: 'Milk', isPerishable: true, maxStorageDays: 7, allergens: ['dairy'], foodGroup: 'dairy' },
  { name: 'Greek yogurt', isPerishable: true, maxStorageDays: 14, allergens: ['dairy'], foodGroup: 'dairy' },
  { name: 'Cheddar cheese', isPerishable: true, maxStorageDays: 21, allergens: ['dairy'], foodGroup: 'dairy' },
  { name: 'Butter', isPerishable: true, maxStorageDays: 60, allergens: ['dairy'], foodGroup: 'dairy' },
  { name: 'Tofu', isPerishable: true, maxStorageDays: 7, allergens: ['soy'], foodGroup: 'proteins' },
  { name: 'Tempeh', isPerishable: true, maxStorageDays: 14, allergens: ['soy'], foodGroup: 'proteins' },
  { name: 'Whole wheat bread', isPerishable: true, maxStorageDays: 7, allergens: ['gluten'], foodGroup: 'grains' },
  { name: 'Pasta', maxStorageDays: 365, allergens: ['gluten'], foodGroup: 'grains' },
  { name: 'Rice', maxStorageDays: 365, foodGroup: 'grains' },
  { name: 'Quinoa', maxStorageDays: 365, foodGroup: 'grains' },
  { name: 'Oats', maxStorageDays: 365, foodGroup: 'grains' },
  { name: 'Olive oil', maxStorageDays: 365, foodGroup: 'fats_oils' },
  { name: 'Garlic', maxStorageDays: 30, foodGroup: 'vegetables' },
  { name: 'Onion', maxStorageDays: 30, foodGroup: 'vegetables' },
  { name: 'Tomato', isPerishable: true, maxStorageDays: 7, foodGroup: 'vegetables' },
  { name: 'Spinach', isPerishable: true, maxStorageDays: 5, requiresFresh: true, foodGroup: 'vegetables' },
  { name: 'Carrot', maxStorageDays: 21, foodGroup: 'vegetables' },
  { name: 'Lemon', maxStorageDays: 21, foodGroup: 'fruits' },
  { name: 'Avocado', isPerishable: true, maxStorageDays: 5, requiresFresh: true, foodGroup: 'fruits' },
  { name: 'Black beans', maxStorageDays: 365, foodGroup: 'proteins' },
  { name: 'Chickpeas', maxStorageDays: 365, foodGroup: 'proteins' },
  { name: 'Peanut butter', maxStorageDays: 365, allergens: ['peanut'], foodGroup: 'proteins' },
  { name: 'Almonds', maxStorageDays: 180, allergens: ['tree_nut'], foodGroup: 'proteins' },
  { name: 'Shrimp', isPerishable: true, maxStorageDays: 1, requiresFresh: true, sameDayCook: true, allergens: ['shellfish'], foodGroup: 'proteins' },
  { name: 'Sesame oil', maxStorageDays: 365, allergens: ['sesame'], foodGroup: 'fats_oils' },
  { name: 'Soy sauce', maxStorageDays: 365, allergens: ['soy'], foodGroup: 'condiments' },
]

export const POST = async (request: NextRequest) => {
  if (!isValidAdminKey({ request })) return forbidden()

  const admin = supabaseAdminClient()

  // Register each distinct food_group value in enum_metadata (idempotent via
  // sys_save_label). The 10 official values were seeded by the migration, so
  // in practice these are all no-ops after the first run.
  const distinctFoodGroups = [...new Set(SEED_INGREDIENTS.map((i) => i.foodGroup))]
  for (const value of distinctFoodGroups) {
    const { error: labelErr } = await admin.rpc('sys_save_label', {
      p_enum_type: 'food_group',
      p_value: value,
    })
    if (labelErr) return serverError(`sys_save_label failed for ${value}: ${labelErr.message}`)
  }

  const upserts = SEED_INGREDIENTS.map((ingredient) => ({
    name: ingredient.name,
    is_perishable: ingredient.isPerishable ?? false,
    max_storage_days: ingredient.maxStorageDays ?? null,
    requires_fresh: ingredient.requiresFresh ?? false,
    same_day_cook: ingredient.sameDayCook ?? false,
    // v2.0 Phase 0: stamp food_group on every catalog ingredient.
    food_group: ingredient.foodGroup,
    food_group_source: 'seed' as const,
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
      food_groups_registered: distinctFoodGroups.length,
    },
  })
}
