import { type NextRequest } from 'next/server'
import {
  getMember,
  setMemberIngredientDislikes,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  formatZodError,
  ingredientIdsBodySchema,
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
  const parsed = ingredientIdsBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    const isSelf = target.user_id === user.id
    if (!isSelf && !hasAdminRole(role)) return forbidden()

    await setMemberIngredientDislikes({
      supabase: user.supabase,
      memberId,
      ingredientIds: parsed.data.ingredient_ids,
    })
    return jsonOk({ ingredient_ids: parsed.data.ingredient_ids })
  })
}
