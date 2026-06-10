import { type NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
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

type RouteParams = { id: string; menuId: string; slotId: string }

type CookBody = { cooked: boolean }

// POST toggles cook-mode completion on a single slot of an ACCEPTED menu.
// Any workspace member (not just admins) may mark a meal cooked — it's a
// runtime progress flag, not a structural edit. cooked_at is set from the
// SERVER clock (never the client, never the engine); cooked_by records who.
// The write goes through the caller-context client: the menu_slots_cook_mode_update
// RLS policy permits authenticated members to update accepted-menu slots.
export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, menuId, slotId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()

  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!role) return forbidden()

  const body = (await request.json().catch(() => null)) as CookBody | null
  if (!body || typeof body.cooked !== 'boolean') {
    return badRequest('expected { cooked: boolean }')
  }

  // Resolve the caller's workspace_member row for cooked_by attribution.
  const { data: memberRow, error: memberErr } = await user.supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memberErr) return serverError(memberErr.message)

  // Verify the slot belongs to this menu + workspace and the menu is accepted.
  const { data: menuRow, error: menuErr } = await user.supabase
    .from('menus')
    .select('id, workspace_id, is_deleted, accepted_at, menu_slots!inner (id)')
    .eq('id', menuId)
    .eq('menu_slots.id', slotId)
    .maybeSingle()
  if (menuErr) return serverError(menuErr.message)
  if (!menuRow) return notFound()
  const m = menuRow as {
    id: string
    workspace_id: string
    is_deleted: boolean
    accepted_at: string | null
    menu_slots: Array<{ id: string }>
  }
  if (m.workspace_id !== workspaceId || m.is_deleted) return notFound()
  if (m.accepted_at === null) {
    return jsonError(
      409,
      'menu_not_accepted',
      'You can only cook meals from an accepted menu. Accept the draft first.',
    )
  }

  const cookedAt = body.cooked ? new Date().toISOString() : null
  const cookedBy = body.cooked ? memberRow?.id ?? null : null

  const { error: updErr } = await user.supabase
    .from('menu_slots')
    .update({ cooked_at: cookedAt, cooked_by: cookedBy })
    .eq('id', slotId)
  if (updErr) return serverError(updErr.message)

  return jsonOk({
    ok: true,
    slot: { id: slotId, cooked_at: cookedAt, cooked_by: cookedBy },
  })
}
