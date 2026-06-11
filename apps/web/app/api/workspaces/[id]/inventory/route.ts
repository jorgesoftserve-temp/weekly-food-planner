import { type NextRequest } from 'next/server'
import {
  createInventoryItem,
  expireLeftovers,
  listInventoryItems,
} from '@weekly-food-planner/supabase'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  createInventoryItemBodySchema,
  formatZodError,
} from '@/lib/api/inventory'
import {
  badRequest,
  forbidden,
  jsonOk,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

// (v2.0 Phase 1) Inventory collection endpoints.
// GET  — any active workspace member may list inventory.
// POST — creator/admin only; created_by is resolved from workspace_members
//        because the module accepts a workspace_members.id, not an auth user id.

type RouteParams = { id: string }

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!role) return forbidden()

  const includeConsumed =
    request.nextUrl.searchParams.get('includeConsumed') === 'true'

  return runWithErrorHandler(async () => {
    // (v2.0 Phase 5) Lazy per-row leftover expiry — no cron in v2, so stock
    // expires on read. Run with the admin client so the sweep is role-
    // independent (a viewer's read still expires another member's leftovers);
    // best-effort, so a sweep failure never blocks the list.
    try {
      await expireLeftovers({
        supabase: supabaseAdminClient(),
        workspaceId,
        todayYmd: new Date().toISOString().slice(0, 10),
      })
    } catch {
      // swallow — listing is the contract; expiry is opportunistic.
    }

    const items = await listInventoryItems({
      supabase: user.supabase,
      workspaceId,
      includeConsumed,
    })
    return jsonOk({ items })
  })
}

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!hasAdminRole(role)) return forbidden()

  const raw = await request.json().catch(() => null)
  const parsed = createInventoryItemBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  // Resolve the caller's workspace_members.id so created_by references the
  // member row rather than the auth user id — matching the module's contract
  // (CreateInventoryItemInput.created_by is a workspace_members.id).
  // Mirrors the same pattern in .../menus/[menuId]/slots/[slotId]/cook/route.ts.
  const { data: memberRow, error: memberErr } = await user.supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memberErr) return serverError(memberErr.message)

  return runWithErrorHandler(async () => {
    const created = await createInventoryItem({
      supabase: user.supabase,
      workspaceId,
      payload: {
        ...parsed.data,
        created_by: memberRow?.id ?? null,
      },
    })
    return jsonOk(created, { status: 201 })
  })
}
