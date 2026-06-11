import { type NextRequest } from 'next/server'
import { createCookLeftovers } from '@/lib/api/leftovers'
import { getAuthenticatedUser, getWorkspaceRole } from '@/lib/api/auth-helpers'
import { cookLeftoversBodySchema, formatZodError } from '@/lib/api/inventory'
import {
  badRequest,
  forbidden,
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'

// (v2.0 Phase 5) Create cook-time leftovers for a single slot of an ACCEPTED
// menu. POST { label?, remainders?: LeftoverLine[], surplus?: LeftoverLine[] }.
//
// `remainders` (used < planned at cook time) become Pantry raw stock
// (source 'cook_remainder'); `surplus` becomes a prepared-dish 'leftover'. Each
// row's expiry is defaulted per-ingredient (max_storage_days else the workspace
// leftover_max_days fallback), counted from the slot's cook date. Purely
// post-accept — writes only inventory_items, never touches accepted_seed, the
// engine, or recomputeGroceryListsForMenu.
//
// Authorization mirrors the cook-status endpoint: any active member may record
// their household's leftovers. Rows are inserted with created_by = the caller's
// workspace_members.id, satisfying the inventory_items row-owner RLS gate.

type RouteParams = { id: string; menuId: string; slotId: string }

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

  const raw = await request.json().catch(() => null)
  const parsed = cookLeftoversBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  // Resolve the caller's workspace_member row for created_by attribution (also
  // the inventory row-owner RLS gate).
  const { data: memberRow, error: memberErr } = await user.supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memberErr) return serverError(memberErr.message)
  const memberId = (memberRow as { id: string } | null)?.id ?? null

  // Verify the slot belongs to this menu + workspace and the menu is accepted;
  // read the slot's cook date so per-leftover expiry counts from when it cooked.
  const { data: menuRow, error: menuErr } = await user.supabase
    .from('menus')
    .select(
      'id, workspace_id, is_deleted, accepted_at, menu_slots!inner (id, cooked_at)',
    )
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
    menu_slots: Array<{ id: string; cooked_at: string | null }>
  }
  if (m.workspace_id !== workspaceId || m.is_deleted) return notFound()
  if (m.accepted_at === null) {
    return jsonError(
      409,
      'menu_not_accepted',
      'You can only record leftovers for an accepted menu.',
    )
  }

  const slotCookedAt = m.menu_slots[0]?.cooked_at
  const cookedAtYmd = (slotCookedAt ?? new Date().toISOString()).slice(0, 10)

  try {
    const result = await createCookLeftovers({
      supabase: user.supabase,
      workspaceId,
      menuId,
      slotId,
      cookedAtYmd,
      label: parsed.data.label ?? null,
      createdBy: memberId,
      remainders: parsed.data.remainders,
      surplus: parsed.data.surplus,
    })
    return jsonOk(result, { status: 201 })
  } catch (err) {
    return serverError(
      err instanceof Error ? err.message : 'failed to create leftovers',
    )
  }
}
