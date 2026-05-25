import { type NextRequest } from 'next/server'
import {
  getRecipe,
  replaceRecipeInstructions,
  type RecipeInstructionInput,
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

type PutBody = { instructions: RecipeInstructionInput[] }

const isValidInstruction = (value: unknown): value is RecipeInstructionInput => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.step_order === 'number' &&
    Number.isInteger(v.step_order) &&
    v.step_order > 0 &&
    typeof v.description === 'string' &&
    v.description.length > 0
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
  if (!body || !Array.isArray(body.instructions)) {
    return badRequest(
      'body must be { instructions: RecipeInstructionInput[] }',
    )
  }
  if (!body.instructions.every(isValidInstruction)) {
    return badRequest(
      'each step needs { step_order: positive int, description: non-empty }',
    )
  }

  return runWithErrorHandler(async () => {
    const recipe = await getRecipe({
      supabase: user.supabase,
      workspaceId,
      recipeId,
    })
    if (!recipe) return notFound()
    await replaceRecipeInstructions({
      supabase: user.supabase,
      recipeId,
      instructions: body.instructions,
    })
    return jsonOk({ instructions: body.instructions })
  })
}
