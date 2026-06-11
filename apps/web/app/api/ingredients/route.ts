import { type NextRequest } from 'next/server'
import {
  createIngredient,
  listIngredients,
  type CreateIngredientPayload,
} from '@weekly-food-planner/supabase'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import { badRequest, jsonOk, unauthorized } from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { classifyIngredientFoodGroup } from '@/lib/api/food-group-classify'

export const GET = async () => {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  return runWithErrorHandler(async () => {
    const ingredients = await listIngredients({ supabase: user.supabase })
    return jsonOk({ ingredients })
  })
}

type PostBody = Partial<CreateIngredientPayload>

// Add a row to the global ingredient catalog. Any authenticated user can add
// — there's no per-workspace ingredient scope; the catalog is shared. RLS
// blocks INSERT for the `authenticated` role so we go through the admin
// client (same pattern as /api/admin/seed-ingredients).
export const POST = async (request: NextRequest) => {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()

  const body = (await request.json().catch(() => null)) as PostBody | null
  if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return badRequest('name is required')
  }
  if (
    body.maxStorageDays !== undefined &&
    body.maxStorageDays !== null &&
    (!Number.isFinite(body.maxStorageDays) || body.maxStorageDays < 0)
  ) {
    return badRequest('maxStorageDays must be a non-negative number')
  }
  if (
    body.allergens !== undefined &&
    (!Array.isArray(body.allergens) ||
      body.allergens.some((a) => typeof a !== 'string'))
  ) {
    return badRequest('allergens must be string[]')
  }

  return runWithErrorHandler(async () => {
    const admin = supabaseAdminClient()
    const ingredient = await createIngredient({
      admin,
      payload: {
        name: body.name as string,
        isPerishable: body.isPerishable,
        maxStorageDays: body.maxStorageDays ?? null,
        requiresFresh: body.requiresFresh,
        sameDayCook: body.sameDayCook,
        allergens: body.allergens,
        // food_group_source defaults to 'unset'; the classifier below stamps
        // 'ai' asynchronously if ANTHROPIC_API_KEY is set.
      },
    })

    // Fire-and-forget: classify the new user ingredient into a food_group.
    // This MUST be non-blocking — ingredient creation must never fail because
    // of a classify error. The result is a catalog annotation only; it is
    // never read by the constraint engine or the menu input builder, and never
    // affects accepted_seed. (v2.0 Phase 0, food-group-classify.ts)
    void classifyIngredientFoodGroup({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
    })

    return jsonOk({ ingredient }, { status: 201 })
  })
}
