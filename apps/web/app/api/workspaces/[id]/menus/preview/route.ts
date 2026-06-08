import { type NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
  hasAdminRole,
} from '@/lib/api/auth-helpers'
import {
  badRequest,
  forbidden,
  jsonError,
  jsonOk,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'
import { buildWeeklyEngineInput } from '@/lib/api/menu-input-builder'
import type { RawOverlay } from '@/lib/api/menu-overlay'
import { generateMenu } from '@weekly-food-planner/constraint-engine'

type RouteParams = { id: string }

// Preview body is the same as the weekly-mode draft body — the engine input
// builder is shared. Custom and clone modes don't apply to preview.
type PreviewBody = {
  weekStartDate: string
  seed?: number
  durationDays?: number
  options?: RawOverlay
  participantMemberIds?: string[]
}

const isValidIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)

// POST /workspaces/:id/menus/preview
//
// Runs the engine and returns the result WITHOUT persisting anything. No menu
// row, no menu_slots, no grocery_lists. The companion `POST /menus` (weekly
// mode) is the persisting path; preview is for what-if loops driven by the
// menu MCP server and exploratory agent workflows.
//
// Auth and request shape mirror the persisting path exactly — same admin-role
// gate, same body, same `buildWeeklyEngineInput`. The drift-detector
// integration test (see agent-log/38) asserts that for the same input, both
// paths produce identical `inputsHash` and identical engine output.
export const POST = async (
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
  if (!hasAdminRole(role)) return forbidden()

  const body = (await request.json().catch(() => null)) as PreviewBody | null
  if (!body || !body.weekStartDate || !isValidIsoDate(body.weekStartDate)) {
    return badRequest('weekStartDate is required (ISO YYYY-MM-DD)')
  }

  return runWithErrorHandler(async () => {
    const built = await buildWeeklyEngineInput({
      supabase: user.supabase,
      workspaceId,
      body,
      nowIso: new Date().toISOString(),
    })
    if (!built.ok) {
      return jsonError(built.status, built.code, built.detail)
    }
    const { input, participantMemberIds, effectiveOverlay, seed, durationDays } = built

    const result = await generateMenu(input)

    if (!result.ok) {
      // Engine refusal — return 422 with the same error envelope shape the
      // persisting path uses, minus generationRunId (no run was persisted).
      return Response.json(
        {
          ok: false,
          mode: 'preview',
          error: result.error,
          seed,
          durationDays,
          effectiveOverlay,
          participantMemberIds,
        },
        { status: 422 },
      )
    }

    return jsonOk({
      ok: true,
      mode: 'preview',
      inputsHash: result.inputsHash,
      seed,
      durationDays,
      effectiveOverlay,
      participantMemberIds,
      menu: result.menu,
      groceryLists: result.groceryLists,
    })
  })
}
