import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  getRecipe,
  softDeleteRecipe,
  type UpdateRecipePatch,
  updateRecipe,
  replaceRecipeMealTypes,
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
import { formatZodError } from '@/lib/api/members'

type RouteParams = { id: string; recipeId: string }

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const RECIPE_KINDS = ['meal', 'addon'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

// (v2.1) PATCH schema — scalar meal_type dropped. Use meal_types (array) for
// replacing the junction set, and recipe_kind for kind toggling. Enforces ≥1
// meal_type when the recipe being patched is (or becomes) kind='meal'. The
// route re-fetches the recipe first so it can carry existing kind forward when
// the patch omits it.
const patchBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  recipe_kind: z.enum(RECIPE_KINDS).optional(),
  // Supplying meal_types replaces the full junction set via replaceRecipeMealTypes.
  meal_types: z.array(z.enum(MEAL_TYPES)).optional(),
  cuisine: z.string().nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  prep_time_minutes: z.number().int().positive().nullable().optional(),
  cook_time_minutes: z.number().int().positive().nullable().optional(),
  servings: z.number().int().positive().optional(),
  calories_per_serving: z.number().positive().nullable().optional(),
}).refine((patch) => Object.keys(patch).length > 0, {
  message: 'at least one field is required',
})

export const GET = async (
  _request: NextRequest,
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
  if (!role) return forbidden()
  return runWithErrorHandler(async () => {
    const recipe = await getRecipe({ supabase: user.supabase, workspaceId, recipeId })
    if (!recipe) return notFound()
    return jsonOk(recipe)
  })
}

export const PATCH = async (
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

  const raw = await request.json().catch(() => null)
  const parsed = patchBodySchema.safeParse(raw)
  if (!parsed.success) {
    return badRequest(formatZodError(parsed.error))
  }

  return runWithErrorHandler(async () => {
    // Re-fetch to resolve effective kind when the patch omits recipe_kind.
    const existing = await getRecipe({ supabase: user.supabase, workspaceId, recipeId })
    if (!existing) return notFound()

    const effectiveKind = parsed.data.recipe_kind ?? existing.recipe_kind

    // (v2.1) Enforce ≥1 meal_type for kind='meal'. If the patch sets
    // meal_types to [], reject. If the patch changes kind to 'meal' but
    // the existing recipe has no meal_types and none are supplied, reject.
    if (effectiveKind === 'meal') {
      const incomingMealTypes = parsed.data.meal_types
      if (incomingMealTypes !== undefined) {
        // Patch explicitly sets meal_types — check the replacement set.
        if (incomingMealTypes.length === 0) {
          return badRequest('meal_types must not be empty for recipe_kind="meal"')
        }
      } else if (existing.meal_types.length === 0) {
        // No patch for meal_types, and the existing record has none (rare, but
        // possible if addon is being changed to meal without supplying types).
        return badRequest('meal_types must not be empty for recipe_kind="meal"')
      }
    }

    // Split patch: scalar columns vs the junction array.
    const { meal_types: newMealTypes, ...scalarPatch } = parsed.data
    const nonEmptyScalar = Object.fromEntries(
      Object.entries(scalarPatch).filter(([, v]) => v !== undefined),
    ) as UpdateRecipePatch

    if (Object.keys(nonEmptyScalar).length > 0) {
      await updateRecipe({ supabase: user.supabase, workspaceId, recipeId, patch: nonEmptyScalar })
    }
    // Replace the junction set when meal_types was explicitly supplied.
    if (newMealTypes !== undefined) {
      await replaceRecipeMealTypes({
        supabase: user.supabase,
        recipeId,
        mealTypes: newMealTypes,
      })
    }

    return jsonOk({ updated: true })
  })
}

export const DELETE = async (
  _request: NextRequest,
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
  return runWithErrorHandler(async () => {
    await softDeleteRecipe({ supabase: user.supabase, workspaceId, recipeId })
    return jsonOk({ deleted: true })
  })
}
