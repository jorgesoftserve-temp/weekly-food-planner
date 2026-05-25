import { type NextRequest } from 'next/server'
import {
  type CreateMemberPayload,
  createMember,
  listMembers,
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
    const members = await listMembers({ supabase: user.supabase, workspaceId })
    return jsonOk({ members })
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

  const body = (await request.json().catch(() => null)) as CreateMemberPayload | null
  if (!body || !body.name || !body.role || !body.age_category) {
    return badRequest('name, role, and age_category are required')
  }
  if (body.role === 'creator') {
    return badRequest(
      'role "creator" is assigned by the signup trigger and cannot be set via API',
    )
  }

  return runWithErrorHandler(async () => {
    const created = await createMember({
      supabase: user.supabase,
      workspaceId,
      payload: body,
    })
    return jsonOk(created, { status: 201 })
  })
}
