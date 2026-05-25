import { type NextRequest } from 'next/server'
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

type RouteParams = { id: string }

export const GET = async (
  _request: NextRequest,
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
    const recipes = await listRecipes({ supabase: user.supabase, workspaceId })
    return jsonOk({ recipes })
  })
}

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

  const body = (await request.json().catch(() => null)) as CreateRecipePayload | null
  if (!body || !body.name || !body.meal_type || !body.difficulty || !body.servings) {
    return badRequest('name, meal_type, difficulty, and servings are required')
  }

  return runWithErrorHandler(async () => {
    const created = await createRecipe({
      supabase: user.supabase,
      workspaceId,
      payload: body,
    })
    return jsonOk(created, { status: 201 })
  })
}
