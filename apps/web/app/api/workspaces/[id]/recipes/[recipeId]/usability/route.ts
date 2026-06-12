import { type NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonError,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { loadEngineSnapshot } from '@/lib/api/menu-loader'
import {
  createFilterContext,
  describeRecipeEligibility,
} from '@weekly-food-planner/constraint-engine'
import type { MealType } from '@weekly-food-planner/constraint-engine'

type RouteParams = { id: string; recipeId: string }

const VALID_MEAL_TYPES = new Set<MealType>([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
])

const isMealType = (value: string): value is MealType =>
  VALID_MEAL_TYPES.has(value as MealType)

// GET /workspaces/:id/recipes/:recipeId/usability?memberId=...&mealType=...
//
// Answers "can member M eat recipe R" — and if not, why. Returns the engine's
// structured `EligibilityBlocker[]` so callers (the menu MCP server, agent
// inspection tools) can render a precise reason instead of an opaque boolean.
//
// Query parameters:
//   memberId  — required. Must be an active workspace_member of this workspace.
//   mealType  — optional. When supplied, the result also reports a
//               `meal_type_mismatch` blocker if the recipe's meal_type doesn't
//               match. Omitting means "I just want to know if the dietary,
//               allergen, and exclusion checks pass" — useful for cross-meal
//               inspection.
//
// Auth: any workspace role (read-only). No admin gate — non-admins can ask
// "would this work for me" without being able to mutate menus.
//
// Overlays are intentionally NOT accepted on this endpoint. For overlay-
// modulated eligibility (e.g. "would this be ok if I added the gluten-free
// restriction") use POST /menus/preview and inspect the resulting menu —
// preview is the single source of truth for that path.
export const GET = async (
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
  if (!role) return forbidden()

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) {
    return badRequest('memberId query parameter is required')
  }
  const mealTypeRaw = searchParams.get('mealType')
  if (mealTypeRaw !== null && !isMealType(mealTypeRaw)) {
    return badRequest(
      `mealType must be one of breakfast | lunch | dinner | snack`,
    )
  }
  const forMealType = mealTypeRaw === null ? undefined : (mealTypeRaw as MealType)

  return runWithErrorHandler(async () => {
    const loaded = await loadEngineSnapshot({
      supabase: user.supabase,
      workspaceId,
    })
    if (!loaded.ok) {
      if (loaded.reason === 'workspace_not_found') return notFound()
      if (loaded.reason === 'no_recipes') {
        return jsonError(
          412,
          'empty_workspace',
          'Workspace has no recipes to evaluate.',
        )
      }
      return jsonError(
        500,
        'snapshot_load_failed',
        loaded.detail ?? 'failed to load engine snapshot',
      )
    }

    const member = loaded.members.find((m) => m.id === memberId)
    if (!member) {
      return jsonError(
        404,
        'member_not_found',
        `Member ${memberId} is not an active member of this workspace.`,
      )
    }
    const recipe = loaded.recipes.find((r) => r.id === recipeId)
    if (!recipe) {
      return jsonError(
        404,
        'recipe_not_found',
        `Recipe ${recipeId} is not an active recipe in this workspace.`,
      )
    }

    const ctx = createFilterContext({
      member,
      options: undefined,
      ingredients: loaded.ingredients,
    })
    const eligibility = describeRecipeEligibility({
      recipe,
      ctx,
      forMealType,
    })

    return jsonOk({
      ok: true,
      workspaceId,
      memberId: member.id,
      recipeId: recipe.id,
      // (v2.1) mealTypes is the set of timeframes; scalar mealType dropped.
      mealTypes: recipe.mealTypes,
      forMealType: forMealType ?? null,
      eligible: eligibility.eligible,
      blockedBy: eligibility.blockedBy,
    })
  })
}
