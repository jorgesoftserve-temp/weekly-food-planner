import { type NextRequest } from 'next/server'
import {
  getWorkspaceWithMembers,
  type MealFrequencyEntry,
  updateWorkspace,
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
    const workspace = await getWorkspaceWithMembers({
      supabase: user.supabase,
      workspaceId,
    })
    if (!workspace) return notFound()
    return jsonOk(workspace)
  })
}

type PatchWorkspaceBody = Partial<{
  name: string
  shared_meal_frequency: MealFrequencyEntry[]
}>

export const PATCH = async (
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

  const body = (await request.json().catch(() => null)) as PatchWorkspaceBody | null
  if (!body) return badRequest('invalid JSON body')

  const patch: PatchWorkspaceBody = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.shared_meal_frequency !== undefined) {
    patch.shared_meal_frequency = body.shared_meal_frequency
  }
  if (Object.keys(patch).length === 0) return badRequest('no fields to update')

  return runWithErrorHandler(async () => {
    await updateWorkspace({ supabase: user.supabase, workspaceId, patch })
    return jsonOk({ updated: true })
  })
}
