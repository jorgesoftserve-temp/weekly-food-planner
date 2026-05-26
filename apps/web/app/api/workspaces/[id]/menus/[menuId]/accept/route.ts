import { type NextRequest } from 'next/server'
import { acceptDraftMenu } from '@/lib/api/menu-accept'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  forbidden,
  jsonError,
  jsonOk,
  unauthorized,
} from '@/lib/api/responses'
import { supabaseAdminClient } from '@/utils/supabase/admin'

type RouteParams = { id: string; menuId: string }

// POST promotes a DRAFT menu to ACCEPTED. The accepted menu becomes the
// workspace's active menu for its week and drives the grocery list. The
// previously accepted menu (if any) is soft-deleted into history.
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

  const admin = supabaseAdminClient()
  const result = await acceptDraftMenu({ admin, workspaceId, menuId })
  if (!result.ok) {
    return jsonError(result.status, result.code, result.detail)
  }
  return jsonOk({ ok: true, menuId, acceptedSeed: result.acceptedSeed })
}
