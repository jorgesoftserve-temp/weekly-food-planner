import { type NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  forbidden,
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { supabaseAdminClient } from '@/utils/supabase/admin'

type RouteParams = { id: string; menuId: string }

// DELETE discards a DRAFT menu. Soft-deletes the row so it disappears from
// the UI but stays queryable by service-role for audit. Refuses to delete
// an accepted menu — those are part of history and need to be superseded
// via re-acceptance, not deleted directly.
export const DELETE = async (
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

  const admin = supabaseAdminClient()

  const { data: row, error: getErr } = await admin
    .from('menus')
    .select('id, workspace_id, is_deleted, accepted_at')
    .eq('id', menuId)
    .maybeSingle()
  if (getErr) return serverError(getErr.message)
  if (!row) return notFound()
  type Row = {
    id: string
    workspace_id: string
    is_deleted: boolean
    accepted_at: string | null
  }
  const m = row as Row
  if (m.workspace_id !== workspaceId || m.is_deleted) return notFound()
  if (m.accepted_at !== null) {
    return jsonError(
      409,
      'menu_accepted',
      'Cannot discard an accepted menu. Generate a new draft to replace it.',
    )
  }

  const { error: updErr } = await admin
    .from('menus')
    .update({ is_deleted: true })
    .eq('id', menuId)
  if (updErr) return serverError(updErr.message)

  return jsonOk({ ok: true, menuId })
}
