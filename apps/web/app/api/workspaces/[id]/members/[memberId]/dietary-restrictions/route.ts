import { type NextRequest } from 'next/server'
import {
  getMember,
  saveLabel,
  setMemberDietaryRestrictions,
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

type RouteParams = { id: string; memberId: string }

type PutBody = { values: string[] }

export const PUT = async (
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

  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body || !Array.isArray(body.values)) {
    return badRequest('body must be { values: string[] }')
  }

  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    const isSelf = target.user_id === user.id
    if (!isSelf && !hasAdminRole(role)) return forbidden()

    for (const value of body.values) {
      await saveLabel({
        supabase: user.supabase,
        enumType: 'dietary_restriction',
        value,
      })
    }
    await setMemberDietaryRestrictions({
      supabase: user.supabase,
      memberId,
      values: body.values,
    })
    return jsonOk({ values: body.values })
  })
}
