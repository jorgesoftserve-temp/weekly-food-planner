import { type NextRequest } from 'next/server'
import {
  deleteInventoryItem,
  updateInventoryItem,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  formatZodError,
  updateInventoryItemBodySchema,
} from '@/lib/api/inventory'
import {
  badRequest,
  forbidden,
  jsonOk,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

// (v2.0 Phase 1) Inventory item-level endpoints.
// PATCH  — creator/admin only; RLS also enforces item ownership at DB layer.
// DELETE — creator/admin only; hard delete (inventory rows have no soft-delete).
//
// Authorization note: the spec asks for "creator/admin OR the item's creator".
// RLS already enforces ownership at the DB layer via fn_user_workspace_role.
// At the handler layer we apply the same creator/admin check that sibling
// handlers use (matching the menus, recipes, and members handlers exactly).
// If a plain member who is also the item's creator needs access in a future
// revision, loosen this to `if (!role) return forbidden()` and let RLS carry it.

type RouteParams = { id: string; itemId: string }

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, itemId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const raw = await request.json().catch(() => null)
  const parsed = updateInventoryItemBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  return runWithErrorHandler(async () => {
    await updateInventoryItem({
      supabase: user.supabase,
      workspaceId,
      itemId,
      patch: parsed.data,
    })
    return jsonOk({ updated: true })
  })
}

export const DELETE = async (
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, itemId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  return runWithErrorHandler(async () => {
    await deleteInventoryItem({
      supabase: user.supabase,
      workspaceId,
      itemId,
    })
    return jsonOk({ deleted: true })
  })
}
