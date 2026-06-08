import { type NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
} from '@/lib/api/auth-helpers'
import {
  forbidden,
  jsonError,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { loadEngineSnapshot } from '@/lib/api/menu-loader'

type RouteParams = { id: string; memberId: string }

// GET /workspaces/:id/members/:memberId/constraints
//
// Returns the full constraint picture for one member, joined server-side:
//   - profile fields (name, role, age category, daily calorie target)
//   - mealFrequency (the cascade source, after profile/workspace fallback)
//   - dietaryRestrictions (array of strings)
//   - allergies (array of strings)
//   - ingredientDislikes (array of ingredient ids)
//
// Existed as four separate PUT-only mutation endpoints. The MCP server needs
// a single GET that returns everything joined to avoid 4 fan-out fetches per
// "show me what blocks this member" inspection. Reuses `loadEngineSnapshot`
// and projects down to one member — same logic as the menu generator sees,
// so the inspection always matches what the engine would see.
//
// Auth: any workspace role (read-only).
export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, memberId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!role) return forbidden()

  return runWithErrorHandler(async () => {
    const loaded = await loadEngineSnapshot({
      supabase: user.supabase,
      workspaceId,
    })
    if (!loaded.ok) {
      if (loaded.reason === 'workspace_not_found') return notFound()
      // no_recipes is fine here — we're inspecting a member, not generating
      if (loaded.reason !== 'no_recipes') {
        return jsonError(
          500,
          'snapshot_load_failed',
          loaded.detail ?? 'failed to load engine snapshot',
        )
      }
    }
    const members = loaded.ok ? loaded.members : []
    const sharedFrequency = loaded.ok
      ? loaded.workspace.sharedMealFrequency
      : undefined
    const member = members.find((m) => m.id === memberId)
    if (!member) {
      return jsonError(
        404,
        'member_not_found',
        `Member ${memberId} is not an active member of this workspace.`,
      )
    }
    return jsonOk({
      ok: true,
      workspaceId,
      memberId: member.id,
      name: member.name,
      role: member.role,
      ageCategory: member.ageCategory,
      dailyCalorieTarget: member.dailyCalorieTarget ?? null,
      // Frequency cascade source — what the engine would actually use.
      mealFrequency:
        member.mealFrequency ?? sharedFrequency ?? null,
      mealFrequencySource: member.mealFrequency
        ? 'member'
        : sharedFrequency
          ? 'workspace'
          : 'none',
      dietaryRestrictions: member.dietaryRestrictions,
      allergies: member.allergies,
      ingredientDislikes: member.ingredientDislikes,
    })
  })
}
