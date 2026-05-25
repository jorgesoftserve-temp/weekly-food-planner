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
  badRequest,
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string; memberId: string }

type PutBody = { ingredient_ids: string[] }

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
  if (!body || !Array.isArray(body.ingredient_ids)) {
    return badRequest('body must be { ingredient_ids: string[] }')
  }

  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    const isSelf = target.user_id === user.id
    if (!isSelf && !hasAdminRole(role)) return forbidden()

    await setMemberIngredientDislikes({
      supabase: user.supabase,
      memberId,
      ingredientIds: body.ingredient_ids,
    })
    return jsonOk({ ingredient_ids: body.ingredient_ids })
  })
}
