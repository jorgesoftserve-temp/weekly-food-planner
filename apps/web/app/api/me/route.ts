import { listWorkspacesForUser } from '@weekly-food-planner/supabase'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'
import { jsonOk, unauthorized } from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

export const GET = async () => {
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  return runWithErrorHandler(async () => {
    const workspaces = await listWorkspacesForUser({
      supabase: user.supabase,
      userId: user.id,
    })
    return jsonOk({
      user: { id: user.id, email: user.email },
      workspaces,
    })
  })
}
