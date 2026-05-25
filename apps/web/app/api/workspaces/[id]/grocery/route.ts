import { type NextRequest } from 'next/server'
import { getActiveGroceryLists } from '@weekly-food-planner/supabase'
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
    const result = await getActiveGroceryLists({
      supabase: user.supabase,
      workspaceId,
      weekStartDate,
    })
    if (!result) return notFound()
    return jsonOk(result)
  })
}
