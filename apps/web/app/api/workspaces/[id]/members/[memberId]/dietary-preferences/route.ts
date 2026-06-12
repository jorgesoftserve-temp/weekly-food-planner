import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  getMember,
  addMemberDietaryPreference,
  removeMemberDietaryPreference,
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
import { formatZodError } from '@/lib/api/members'

// (v2.1 Track C) Inclusive dietary preferences for a member.
// Mirrors POST .../dietary-restrictions but targets member_dietary_preferences
// (soft-bias, never hard-filter). Auth: self OR admin/creator.
//
// POST — attach one preference row (kind + value).
// DELETE — remove one preference row by id.
//
// Status codes:
//   401  no authenticated user
//   403  caller is not a member of the workspace, or a non-admin trying to
//        modify another member's preferences
//   404  workspace or member not found
//   422  invalid body (Zod)
//   500  unexpected DB error

type RouteParams = { id: string; memberId: string }

const PREFERENCE_KINDS = ['dietary_tag', 'ingredient'] as const

const postBodySchema = z.object({
  kind: z.enum(PREFERENCE_KINDS),
  // For kind='ingredient' this must be a UUID (ingredient.id).
  // For kind='dietary_tag' it is a free-text label string.
  // We accept both as a non-empty string and let the DB enforce FK for
  // ingredient kind (which will produce a 500 that the caller can map to 422
  // at the UI layer). A stricter per-kind Zod branch is straightforward to add
  // once the UI decides the exact validation UX.
  value: z.string().trim().min(1, 'value is required'),
})

const deleteBodySchema = z.object({
  preferenceId: z.string().uuid('preferenceId must be a UUID'),
})

// POST /workspaces/:id/members/:memberId/dietary-preferences
export const POST = async (
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
  const parsed = postBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    const isSelf = target.user_id === user.id
    if (!isSelf && !hasAdminRole(role)) return forbidden()

    const pref = await addMemberDietaryPreference({
      supabase: user.supabase,
      payload: {
        member_id: memberId,
        workspace_id: workspaceId,
        kind: parsed.data.kind,
        value: parsed.data.value,
      },
    })
    return jsonOk(pref, { status: 201 })
  })
}

// DELETE /workspaces/:id/members/:memberId/dietary-preferences
// Body: { preferenceId: string }
export const DELETE = async (
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
  const parsed = deleteBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  return runWithErrorHandler(async () => {
    const target = await getMember({ supabase: user.supabase, workspaceId, memberId })
    if (!target) return notFound()
    const isSelf = target.user_id === user.id
    if (!isSelf && !hasAdminRole(role)) return forbidden()

    await removeMemberDietaryPreference({
      supabase: user.supabase,
      preferenceId: parsed.data.preferenceId,
    })
    return jsonOk({ deleted: true })
  })
}
