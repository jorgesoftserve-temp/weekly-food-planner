import { type NextRequest } from 'next/server'
import {
  getRecipe,
  softDeleteRecipe,
  type UpdateRecipePatch,
  updateRecipe,
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

  const body = (await request.json().catch(() => null)) as UpdateRecipePatch | null
  if (!body) return badRequest('invalid JSON body')

  return runWithErrorHandler(async () => {
    await updateRecipe({ supabase: user.supabase, workspaceId, recipeId, patch: body })
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
