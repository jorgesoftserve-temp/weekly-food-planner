import { type NextRequest } from 'next/server'
import {
  getRecipe,
  replaceRecipeIngredients,
  type RecipeIngredientInput,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string; recipeId: string }

type PutBody = { ingredients: RecipeIngredientInput[] }

const isValidIngredient = (value: unknown): value is RecipeIngredientInput => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.ingredient_id === 'string' &&
    v.ingredient_id.length > 0 &&
    typeof v.quantity === 'number' &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0 &&
    typeof v.unit === 'string'
  )
}

export const PUT = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, recipeId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body || !Array.isArray(body.ingredients)) {
    return badRequest('body must be { ingredients: RecipeIngredientInput[] }')
  }
  if (!body.ingredients.every(isValidIngredient)) {
    return badRequest(
      'each ingredient needs { ingredient_id, quantity > 0, unit }',
    )
  }

  return runWithErrorHandler(async () => {
    const recipe = await getRecipe({
      supabase: user.supabase,
      workspaceId,
      recipeId,
    })
    if (!recipe) return notFound()
    await replaceRecipeIngredients({
      supabase: user.supabase,
      recipeId,
      ingredients: body.ingredients,
    })
    return jsonOk({ ingredients: body.ingredients })
  })
}
