import { type NextRequest } from 'next/server'
import {
  getMember,
  softDeleteMember,
  updateMember,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  formatZodError,
  updateMemberBodySchema,
} from '@/lib/api/members'
import {
  badRequest,
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string; memberId: string }

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, memberId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!role) return forbidden()
  return runWithErrorHandler(async () => {
    const member = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!member) return notFound()
    return jsonOk(member)
  })
}

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, memberId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!role) return forbidden()

  const raw = await request.json().catch(() => null)
  const parsed = updateMemberBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))
  const patch = parsed.data

  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    const isSelf = target.user_id === user.id
    const editingRole = patch.role !== undefined && patch.role !== target.role
    if (editingRole && !hasAdminRole(role)) {
      return forbidden()
    }
    if (!isSelf && !hasAdminRole(role)) {
      return forbidden()
    }
    if (target.role === 'creator' && patch.role !== undefined) {
      return badRequest('cannot change the creator role')
    }
    await updateMember({
      supabase: user.supabase,
      workspaceId,
      memberId,
      patch,
    })
    return jsonOk({ updated: true })
  })
}

export const DELETE = async (
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, memberId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()
  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    if (target.role === 'creator') {
      return badRequest('the creator member cannot be deleted')
    }
    await softDeleteMember({ supabase: user.supabase, workspaceId, memberId })
    return jsonOk({ deleted: true })
  })
}
