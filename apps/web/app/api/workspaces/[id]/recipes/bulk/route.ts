import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createRecipesBulk } from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonOk,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { formatZodError } from '@/lib/api/members'

// (v2.1 Track E) POST /workspaces/:id/recipes/bulk
//
// Transactional all-or-nothing batch recipe create. Each element in `recipes`
// is validated against the same per-recipe Zod schema as single-create. A
// single invalid payload causes the entire batch to be rejected with 422 and
// nothing is written (validate-all-first guarantee in createRecipesBulk +
// compensating-delete on child-insert failure). See ARCHITECTURE_PRD §24.
//
// Returns: { ids: string[] } — the created recipe ids, in order.
//
// Status codes:
//   201  all recipes created; body { ids: string[] }
//   400  malformed JSON or empty recipes array
//   401  no authenticated user
//   403  caller is not admin/creator of this workspace
//   422  any recipe in the batch fails Zod validation (nothing written)
//   500  unexpected DB error (will NOT occur for constraint violations that
//        Zod catches; only truly unexpected infra failures)

type RouteParams = { id: string }

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const RECIPE_KINDS = ['meal', 'addon'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const UNITS = [
  'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece',
  'slice', 'pinch', 'clove', 'can', 'pack',
] as const

// Per-recipe schema — intentionally identical to the one in the single-create
// POST handler so validation semantics are consistent across both paths.
const singleRecipeSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  recipe_kind: z.enum(RECIPE_KINDS).optional().default('meal'),
  meal_types: z.array(z.enum(MEAL_TYPES)).optional(),
  cuisine: z.string().trim().optional(),
  difficulty: z.enum(DIFFICULTIES),
  prep_time_minutes: z.number().int().positive().optional(),
  cook_time_minutes: z.number().int().positive().optional(),
  servings: z.number().int().positive('servings must be a positive integer'),
  calories_per_serving: z.number().positive().optional(),
  ingredients: z
    .array(
      z.object({
        ingredient_id: z.string().uuid(),
        quantity: z.number().positive(),
        unit: z.enum(UNITS),
        substitutions: z
          .array(z.object({ ingredient_id: z.string().uuid(), note: z.string().optional() }))
          .optional(),
        is_perishable_override: z.boolean().nullable().optional(),
      }),
    )
    .optional(),
  instructions: z
    .array(
      z.object({
        step_order: z.number().int().positive(),
        description: z.string().trim().min(1),
        notes: z.string().optional(),
        duration_minutes: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  dietary_tags: z.array(z.string().trim().min(1)).optional(),
}).superRefine((data, ctx) => {
  const kind = data.recipe_kind ?? 'meal'
  if (kind === 'meal' && (!data.meal_types || data.meal_types.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['meal_types'],
      message: 'At least one meal_type is required when recipe_kind is "meal"',
    })
  }
})

const bulkBodySchema = z.object({
  recipes: z.array(singleRecipeSchema).min(1, 'recipes must not be empty'),
})

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const raw = await request.json().catch(() => null)
  if (!raw) return badRequest('invalid JSON body')

  const parsed = bulkBodySchema.safeParse(raw)
  if (!parsed.success) {
    return badRequest(formatZodError(parsed.error))
  }

  return runWithErrorHandler(async () => {
    const result = await createRecipesBulk({
      supabase: user.supabase,
      workspaceId,
      recipes: parsed.data.recipes,
    })
    return jsonOk(result, { status: 201 })
  })
}
