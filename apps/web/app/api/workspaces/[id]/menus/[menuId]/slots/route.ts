import { type NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import {
  addSlotToDraftMenu,
  isValidDay,
  isValidMealType,
  type AddSlotBody,
} from '@/lib/api/menu-add-slot'
import { supabaseAdminClient } from '@/utils/supabase/admin'

type RouteParams = { id: string; menuId: string }

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, menuId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const raw = (await request.json().catch(() => null)) as Partial<AddSlotBody> | null
  if (!raw) return badRequest('invalid JSON body')
  if (!isValidDay(raw.dayOfWeek)) return badRequest('invalid dayOfWeek')
  if (!isValidMealType(raw.mealType)) return badRequest('invalid mealType')
  if (typeof raw.recipeId !== 'string' || raw.recipeId.length === 0) {
    return badRequest('recipeId is required')
  }
  const targetMemberId =
    raw.targetMemberId === undefined ? null : raw.targetMemberId
  if (targetMemberId !== null && typeof targetMemberId !== 'string') {
    return badRequest('targetMemberId must be a UUID or null')
  }

  const result = await addSlotToDraftMenu({
    admin: supabaseAdminClient(),
    supabase: user.supabase,
    workspaceId,
    menuId,
    body: {
      dayOfWeek: raw.dayOfWeek,
      mealType: raw.mealType,
      recipeId: raw.recipeId,
      targetMemberId,
    },
  })

  if (result.ok) return jsonOk({ ok: true, slot: result.slot }, { status: 201 })

  switch (result.reason) {
    case 'not_found':
      return notFound()
    case 'menu_accepted':
      return jsonError(409, 'menu_accepted', result.detail ?? 'menu accepted')
    case 'not_a_participant':
      return jsonError(422, 'not_a_participant', result.detail ?? '')
    case 'meal_type_mismatch':
      return jsonError(422, 'meal_type_mismatch', result.detail ?? '')
    case 'constraint_violation':
      return jsonError(422, 'constraint_violation', result.detail ?? '')
    case 'too_many_meals':
      return jsonError(422, 'too_many_meals', result.detail ?? '')
    case 'recipe_not_in_workspace':
      return badRequest('recipe not found in this workspace')
    case 'snapshot_load_failed':
    case 'db_error':
    default:
      return serverError(result.detail ?? 'add-slot failed')
  }
}
