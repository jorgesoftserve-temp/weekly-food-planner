import { type NextRequest } from 'next/server'
import {
  getGroceryListsForMenuId,
  openShoppingSession,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  conflict,
  forbidden,
  jsonOk,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

// (v2.0 Phase 2) Open a shopping session for an accepted menu.
// POST — creator/admin only. Collects all grocery item ids from the menu's
//        grocery lists and seeds one pending shopping_item_status row per item.
//        The partial unique index (menu_id) WHERE status='in_progress' on
//        shopping_sessions guards against duplicate open sessions; a unique
//        violation is caught and returned as 409 conflict rather than 500.

type RouteParams = { id: string; menuId: string }

export const POST = async (
  _request: NextRequest,
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

  // Resolve the caller's workspace_members.id — created_by references the
  // member row rather than the auth user id. Mirrors the same lookup in the
  // inventory POST handler.
  const { data: memberRow, error: memberErr } = await user.supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memberErr) return serverError(memberErr.message)

  return runWithErrorHandler(async () => {
    // Load all grocery item ids across every list for this menu.
    const lists = await getGroceryListsForMenuId({
      supabase: user.supabase,
      menuId,
    })
    const groceryItemIds = lists.flatMap((list) =>
      list.grocery_items.map((item) => item.id),
    )

    let created: { id: string }
    try {
      created = await openShoppingSession({
        supabase: user.supabase,
        workspaceId,
        menuId,
        groceryItemIds,
        createdBy: memberRow?.id ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      // The partial unique index on (menu_id) WHERE status='in_progress' fires
      // as a unique-constraint violation when a session is already open.
      if (
        message.toLowerCase().includes('unique') ||
        message.toLowerCase().includes('duplicate') ||
        message.toLowerCase().includes('already exists')
      ) {
        return conflict('an open shopping session already exists for this menu')
      }
      throw err
    }

    return jsonOk(created, { status: 201 })
  })
}
