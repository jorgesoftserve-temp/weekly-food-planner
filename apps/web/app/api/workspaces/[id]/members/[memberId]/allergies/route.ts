import { type NextRequest } from 'next/server'
import {
  getMember,
  setMemberAllergies,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import { formatZodError, valuesBodySchema } from '@/lib/api/members'
import {
  badRequest,
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string; memberId: string }

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

  const raw = await request.json().catch(() => null)
  const parsed = valuesBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    const isSelf = target.user_id === user.id
    if (!isSelf && !hasAdminRole(role)) return forbidden()

    await setMemberAllergies({
      supabase: user.supabase,
      memberId,
      values: parsed.data.values,
    })
    return jsonOk({ values: parsed.data.values })
  })
}
