import { type NextRequest } from 'next/server'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import { isValidAdminKey } from '@/lib/api/admin-key'
import {
  badRequest,
  forbidden,
  jsonOk,
  serverError,
} from '@/lib/api/responses'

type SeedRecipe = {
  name: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  difficulty: 'easy' | 'medium' | 'hard'
  servings: number
  caloriesPerServing: number
  cuisine: string
  dietaryTags: string[]
  ingredients: Array<{ name: string; quantity: number; unit: string }>
}

// Six-recipe spread covering breakfast/lunch/dinner × two cuisines each, all
// vegetarian, allergen-mild. Lets the engine generate a full week without
// requiring manual recipe entry.
const SEED_RECIPES: ReadonlyArray<SeedRecipe> = [
  {
    name: 'Oatmeal bowl',
    mealType: 'breakfast',
    difficulty: 'easy',
    servings: 1,
    caloriesPerServing: 320,
    cuisine: 'american',
    dietaryTags: ['vegetarian', 'high_protein'],
    ingredients: [
      { name: 'Oats', quantity: 0.5, unit: 'cup' },
      { name: 'Milk', quantity: 1, unit: 'cup' },
    ],
  },
  {
    name: 'Veggie omelette',
    mealType: 'breakfast',
    difficulty: 'easy',
    servings: 1,
    caloriesPerServing: 280,
    cuisine: 'french',
    dietaryTags: ['vegetarian', 'gluten_free'],
    ingredients: [
      { name: 'Eggs', quantity: 2, unit: 'piece' },
      { name: 'Spinach', quantity: 0.5, unit: 'cup' },
      { name: 'Tomato', quantity: 1, unit: 'piece' },
    ],
  },
  {
    name: 'Quinoa power bowl',
    mealType: 'lunch',
    difficulty: 'easy',
    servings: 1,
    caloriesPerServing: 480,
    cuisine: 'mediterranean',
    dietaryTags: ['vegetarian', 'gluten_free', 'high_protein'],
    ingredients: [
      { name: 'Quinoa', quantity: 1, unit: 'cup' },
      { name: 'Chickpeas', quantity: 0.5, unit: 'cup' },
      { name: 'Spinach', quantity: 1, unit: 'cup' },
      { name: 'Lemon', quantity: 0.5, unit: 'piece' },
    ],
  },
  {
    name: 'Black-bean tacos',
    mealType: 'lunch',
    difficulty: 'easy',
    servings: 2,
    caloriesPerServing: 420,
    cuisine: 'mexican',
    dietaryTags: ['vegetarian'],
    ingredients: [
      { name: 'Black beans', quantity: 1, unit: 'cup' },
      { name: 'Avocado', quantity: 1, unit: 'piece' },
      { name: 'Tomato', quantity: 1, unit: 'piece' },
    ],
  },
  {
    name: 'Tofu stir-fry',
    mealType: 'dinner',
    difficulty: 'medium',
    servings: 2,
    caloriesPerServing: 510,
    cuisine: 'chinese',
    dietaryTags: ['vegetarian', 'vegan', 'high_protein'],
    ingredients: [
      { name: 'Tofu', quantity: 1, unit: 'pack' },
      { name: 'Carrot', quantity: 2, unit: 'piece' },
      { name: 'Garlic', quantity: 2, unit: 'clove' },
      { name: 'Soy sauce', quantity: 2, unit: 'tbsp' },
    ],
  },
  {
    name: 'Pasta primavera',
    mealType: 'dinner',
    difficulty: 'easy',
    servings: 2,
    caloriesPerServing: 540,
    cuisine: 'italian',
    dietaryTags: ['vegetarian'],
    ingredients: [
      { name: 'Pasta', quantity: 0.5, unit: 'pack' },
      { name: 'Tomato', quantity: 2, unit: 'piece' },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'Garlic', quantity: 2, unit: 'clove' },
    ],
  },
]

type SeedBody = { workspaceId: string }

export const POST = async (request: NextRequest) => {
  if (!isValidAdminKey({ request })) return forbidden()

  const body = (await request.json().catch(() => null)) as SeedBody | null
  if (!body?.workspaceId) return badRequest('workspaceId is required')

  const admin = supabaseAdminClient()

  // Resolve ingredient names → IDs (assumes /api/admin/seed-ingredients ran).
  const { data: ingredientRows, error: ingErr } = await admin
    .from('ingredients')
    .select('id, name')
  if (ingErr) return serverError(ingErr.message)
  const nameToId = new Map<string, string>()
  for (const row of (ingredientRows ?? []) as Array<{ id: string; name: string }>) {
    nameToId.set(row.name, row.id)
  }

  let createdCount = 0
  for (const seed of SEED_RECIPES) {
    const resolved = seed.ingredients
      .map((i) => ({ ...i, ingredient_id: nameToId.get(i.name) }))
      .filter((i): i is typeof i & { ingredient_id: string } => Boolean(i.ingredient_id))
    if (resolved.length === 0) continue

    const { data: recipeRow, error: recErr } = await admin
      .from('recipes')
      .insert({
        workspace_id: body.workspaceId,
        name: seed.name,
        meal_type: seed.mealType,
        cuisine: seed.cuisine,
        difficulty: seed.difficulty,
        servings: seed.servings,
        calories_per_serving: seed.caloriesPerServing,
      })
      .select('id')
      .single()
    if (recErr || !recipeRow) {
      return serverError(recErr?.message ?? 'recipe insert failed')
    }
    const recipeId = (recipeRow as { id: string }).id

    const { error: ingertErr } = await admin.from('recipe_ingredients').insert(
      resolved.map((i) => ({
        recipe_id: recipeId,
        ingredient_id: i.ingredient_id,
        quantity: i.quantity,
        unit: i.unit,
      })),
    )
    if (ingertErr) return serverError(ingertErr.message)

    const { error: tagErr } = await admin.from('recipe_dietary_tags').insert(
      seed.dietaryTags.map((tag) => ({ recipe_id: recipeId, tag })),
    )
    if (tagErr) return serverError(tagErr.message)

    createdCount++
  }

  return jsonOk({ seeded: createdCount })
}
