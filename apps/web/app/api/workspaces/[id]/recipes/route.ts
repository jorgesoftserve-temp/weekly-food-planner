import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  createRecipe,
  type CreateRecipePayload,
  listRecipes,
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
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { formatZodError } from '@/lib/api/members'

type RouteParams = { id: string }

// (v2.1) Zod schema for recipe creation — replaces the manual null-check that
// predated the v2.1 meal_types / recipe_kind additions. Mirrors the module's
// CreateRecipePayload shape. Lives here rather than a sibling schema.ts file
// so the route file stays self-contained; move to schema.ts if more handlers
// in this folder need it.
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const RECIPE_KINDS = ['meal', 'addon'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const UNITS = [
  'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece',
  'slice', 'pinch', 'clove', 'can', 'pack',
] as const

const recipeIngredientSchema = z.object({
  ingredient_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.enum(UNITS),
  substitutions: z.array(
    z.object({ ingredient_id: z.string().uuid(), note: z.string().optional() }),
  ).optional(),
  is_perishable_override: z.boolean().nullable().optional(),
})

const recipeInstructionSchema = z.object({
  step_order: z.number().int().positive(),
  description: z.string().trim().min(1),
  notes: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
})

const createRecipeBodySchema = z.object({
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
  ingredients: z.array(recipeIngredientSchema).optional(),
  instructions: z.array(recipeInstructionSchema).optional(),
  dietary_tags: z.array(z.string().trim().min(1)).optional(),
}).superRefine((data, ctx) => {
  // (v2.1) Enforce ≥1 meal_type when recipe_kind='meal' (or default 'meal').
  // Addons may have zero meal_types.
  const kind = data.recipe_kind ?? 'meal'
  if (kind === 'meal' && (!data.meal_types || data.meal_types.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['meal_types'],
      message: 'At least one meal_type is required when recipe_kind is "meal"',
    })
  }
})

// GET /workspaces/:id/recipes[?kind=addon|meal]
//
// (v2.1) Optional ?kind query param filters by recipe_kind. Omitting kind
// returns all recipes (the pre-v2.1 behaviour). kind=addon powers the addon
// picker. kind=meal powers the engine snapshot loader's sibling picker UI.
export const GET = async (
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
  if (!role) return forbidden()
  return runWithErrorHandler(async () => {
    const { searchParams } = new URL(request.url)
    const kindParam = searchParams.get('kind') as 'meal' | 'addon' | null
    const recipes = await listRecipes({ supabase: user.supabase, workspaceId })
    // Filter client-side; listRecipes already scopes to the workspace + not
    // deleted. A DB-level filter can be added to the module if perf demands it.
    const filtered =
      kindParam === 'meal' || kindParam === 'addon'
        ? recipes.filter((r) => r.recipe_kind === kindParam)
        : recipes
    return jsonOk({ recipes: filtered })
  })
}

// POST /workspaces/:id/recipes
//
// (v2.1) Now validates meal_types + recipe_kind via Zod. The ≥1 meal_type
// rule is enforced here (422) and again in the module as defence-in-depth.
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
  const parsed = createRecipeBodySchema.safeParse(raw)
  if (!parsed.success) {
    return badRequest(formatZodError(parsed.error))
  }

  return runWithErrorHandler(async () => {
    const payload: CreateRecipePayload = {
      ...parsed.data,
      // Zod default coerces recipe_kind to 'meal' when absent; pass it through.
      recipe_kind: parsed.data.recipe_kind,
    }
    const created = await createRecipe({
      supabase: user.supabase,
      workspaceId,
      payload,
    })
    return jsonOk(created, { status: 201 })
  })
}
