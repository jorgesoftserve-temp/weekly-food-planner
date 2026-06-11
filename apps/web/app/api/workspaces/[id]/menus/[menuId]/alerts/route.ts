import { type NextRequest } from 'next/server'
import { getAuthenticatedUser, getWorkspaceRole } from '@/lib/api/auth-helpers'
import { forbidden, jsonOk, unauthorized } from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { deriveShoppingAlertsForMenu } from '@/lib/api/menu-alerts'

// (v2.0 Phase 3) Incomplete-shopping alerts for an accepted menu.
// GET — any active workspace member may read. Fully derived (no table), so this
//       handler only reads. Returns { result } where result.alerts is one entry
//       per not-yet-cooked slot whose recipe needs an unacquired ingredient the
//       pantry can't cover. No session → hasSession:false, alerts:[].

type RouteParams = { id: string; menuId: string }

export const GET = async (
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
  if (!role) return forbidden()

  return runWithErrorHandler(async () => {
    const result = await deriveShoppingAlertsForMenu({
      supabase: user.supabase,
      menuId,
    })
    return jsonOk({ result })
  })
}
