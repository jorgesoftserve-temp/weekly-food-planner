import { type NextRequest } from 'next/server'
import { getShoppingSessionById } from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import { finalizeShoppingSession } from '@/lib/api/shopping-finalize'
import {
  conflict,
  forbidden,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

// (v2.0 Phase 2) Finalise a shopping session.
// POST — creator/admin only.
//        Loads the session, guards against double-finalisation (409 if already
//        terminal), computes completeness, persists status/completeness, and
//        spills purchased items into inventory_items(source='purchase').
//        Does NOT call recomputeGroceryListsForMenu.

type RouteParams = { id: string; menuId: string; sid: string }

export const POST = async (
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, menuId, sid: sessionId } = await params

  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()

  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  // Resolve the caller's workspace_members.id for created_by on the inventory
  // spill rows. Mirrors the same inline lookup in the inventory POST handler.
  const { data: memberRow, error: memberErr } = await user.supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memberErr) return serverError(memberErr.message)

  return runWithErrorHandler(async () => {
    const session = await getShoppingSessionById({
      supabase: user.supabase,
      sessionId,
    })

    // 404 if not found or belongs to a different menu/workspace.
    if (!session || session.workspace_id !== workspaceId || session.menu_id !== menuId) {
      return notFound()
    }

    // 409 if already finalised — the session must be in_progress to finalise.
    if (session.status !== 'in_progress') {
      return conflict('this shopping session has already been finalised')
    }

    const result = await finalizeShoppingSession({
      supabase: user.supabase,
      workspaceId,
      session,
      createdBy: memberRow?.id ?? null,
    })

    return jsonOk(result)
  })
}
