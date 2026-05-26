import { type NextRequest } from 'next/server'
import { listAcceptedMenus } from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
} from '@/lib/api/auth-helpers'
import { forbidden, jsonOk, unauthorized } from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string }

const DEFAULT_LIMIT = 26
const MAX_LIMIT = 100

// GET lists accepted menus for the workspace in reverse-chronological order.
// Each entry carries the engine seed, the accepted seed (final state hash),
// and a flag indicating whether the user modified any slot before acceptance.
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

  const { searchParams } = new URL(request.url)
  const limitRaw = searchParams.get('limit')
  const limit = limitRaw ? Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(limitRaw, 10) || DEFAULT_LIMIT)) : DEFAULT_LIMIT

  return runWithErrorHandler(async () => {
    const entries = await listAcceptedMenus({
      supabase: user.supabase,
      workspaceId,
      limit,
    })
    return jsonOk({ entries })
  })
}
