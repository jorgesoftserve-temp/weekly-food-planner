import { type NextRequest } from 'next/server'
import { updateShoppingItemStatus } from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import { formatZodError, updateShoppingItemBodySchema } from '@/lib/api/shopping'
import {
  badRequest,
  forbidden,
  jsonOk,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

// (v2.0 Phase 2) Update one grocery-line's acquisition state within a session.
// PATCH — creator/admin only.
//         Validates { acquired_quantity?, status? }; at least one field required.

type RouteParams = {
  id: string
  menuId: string
  sid: string
  groceryItemId: string
}

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, sid: sessionId, groceryItemId } = await params

  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()

  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const raw = await request.json().catch(() => null)
  const parsed = updateShoppingItemBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  return runWithErrorHandler(async () => {
    await updateShoppingItemStatus({
      supabase: user.supabase,
      sessionId,
      groceryItemId,
      patch: parsed.data,
    })
    return jsonOk({ updated: true })
  })
}
