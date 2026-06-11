import { type NextRequest } from 'next/server'
import { upsertSlotCompletion, type DbTypes } from '@weekly-food-planner/supabase'

type SlotCookStatus = DbTypes.SlotCookStatus
import { getAuthenticatedUser, getWorkspaceRole } from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'

// (v2.0 Phase 4) Record cook-status for a single slot of an ACCEPTED menu.
// PATCH { status: 'planned' | 'cooked' | 'skipped'; notes?: string | null }.
//
// slot_completions is the richer execution record (drives leftovers + alerts);
// it is a SEPARATE table from menu_slots so it never touches accepted_seed or
// the engine. Any active workspace member may flip cook-status — it's a runtime
// household action, exactly like the v1.9 cook toggle. cooked_at is server-set.
//
// Reconciliation with the v1.9 cook-mode toggle: when status flips to 'cooked'
// we ALSO set menu_slots.cooked_at/cooked_by (and clear them otherwise) so the
// dashboard "cooked this week" stat and the menu-view cooked styling stay
// consistent across both surfaces — slot_completions is the source of truth.

type RouteParams = { id: string; menuId: string; slotId: string }

type CompletionBody = { status: SlotCookStatus; notes?: string | null }

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'planned',
  'cooked',
  'skipped',
])

export const PATCH = async (
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

  const body = (await request.json().catch(() => null)) as CompletionBody | null
  if (!body || !VALID_STATUSES.has(body.status)) {
    return badRequest("expected { status: 'planned' | 'cooked' | 'skipped' }")
  }
  if (body.notes != null && typeof body.notes !== 'string') {
    return badRequest('notes must be a string or null')
  }

  // Resolve the caller's workspace_member row for created_by / cooked_by attribution.
  const { data: memberRow, error: memberErr } = await user.supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .maybeSingle()
  if (memberErr) return serverError(memberErr.message)
  const memberId = (memberRow as { id: string } | null)?.id ?? null

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
  }
  if (m.workspace_id !== workspaceId || m.is_deleted) return notFound()
  if (m.accepted_at === null) {
    return jsonError(
      409,
      'menu_not_accepted',
      'You can only record cook-status for an accepted menu. Accept the draft first.',
    )
  }

  const cookedAt = body.status === 'cooked' ? new Date().toISOString() : null

  try {
    const completion = await upsertSlotCompletion({
      supabase: user.supabase,
      payload: {
        menu_slot_id: slotId,
        workspace_id: workspaceId,
        status: body.status,
        cooked_at: cookedAt,
        notes: body.notes ?? null,
        created_by: memberId,
      },
    })

    // Keep the v1.9 cook-mode flag in sync so both surfaces agree.
    const { error: syncErr } = await user.supabase
      .from('menu_slots')
      .update({
        cooked_at: cookedAt,
        cooked_by: body.status === 'cooked' ? memberId : null,
      })
      .eq('id', slotId)
    if (syncErr) return serverError(syncErr.message)

    return jsonOk({ completion })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'failed to record cook-status')
  }
}
