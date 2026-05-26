import { type NextRequest } from 'next/server'
import { getDraftMenu } from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
} from '@/lib/api/auth-helpers'
import {
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string }

// GET returns the workspace's outstanding draft menu (if any). At most one
// draft per (workspace, week) per the partial unique index from migration
// 20260526000100.
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
  const weekStartDate = searchParams.get('week_start_date') ?? undefined

  return runWithErrorHandler(async () => {
    const menu = await getDraftMenu({
      supabase: user.supabase,
      workspaceId,
      weekStartDate,
    })
    if (!menu) return notFound()
    return jsonOk(menu)
  })
}
