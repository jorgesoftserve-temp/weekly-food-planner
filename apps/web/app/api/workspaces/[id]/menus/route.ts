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
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api/responses'
import { loadEngineSnapshot } from '@/lib/api/menu-loader'
import { computeEffectiveOverlay, type RawOverlay } from '@/lib/api/menu-overlay'
import { persistGeneratedMenu } from '@/lib/api/menu-persistence'
import {
  cloneMenuAsDraft,
  persistCustomMenu,
  type CustomSlotInput,
} from '@/lib/api/menu-build'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import { generateMenu } from '@weekly-food-planner/constraint-engine'
import type { GenerateMenuInput } from '@weekly-food-planner/constraint-engine'

type RouteParams = { id: string }

type WeeklyBody = {
  mode?: 'weekly' // default
  weekStartDate: string
  seed?: number
  durationDays?: number
  options?: RawOverlay
}

type CustomBody = {
  mode: 'custom'
  weekStartDate: string
  durationDays?: number
  slots: CustomSlotInput[]
  options?: RawOverlay
}

type CloneBody = {
  mode: 'clone'
  weekStartDate: string
  cloneFromMenuId: string
}

type GenerateBody = WeeklyBody | CustomBody | CloneBody

const generateRandomSeed = (): number => Math.floor(Math.random() * 2_147_483_647)

const clampDuration = (raw: number | undefined): number => {
  if (raw === undefined || raw === null) return 7
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 7
  return Math.max(1, Math.min(7, n))
}

const isValidIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)

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

  const body = (await request.json().catch(() => null)) as GenerateBody | null
  if (!body || !body.weekStartDate || !isValidIsoDate(body.weekStartDate)) {
    return badRequest('weekStartDate is required (ISO YYYY-MM-DD)')
  }

  const mode = body.mode ?? 'weekly'
  const admin = supabaseAdminClient()

  // ---- Clone mode --------------------------------------------------------
  if (mode === 'clone') {
    const cloneBody = body as CloneBody
    if (!cloneBody.cloneFromMenuId) {
      return badRequest('cloneFromMenuId is required when mode = "clone"')
    }
    const result = await cloneMenuAsDraft({
      admin,
      workspaceId,
      sourceMenuId: cloneBody.cloneFromMenuId,
      weekStartDate: cloneBody.weekStartDate,
    })
    if (!result.ok) {
      return jsonError(result.status, result.code, result.detail)
    }
    return jsonOk({ ok: true, menuId: result.menuId, mode: 'clone' })
  }

  // ---- Custom mode -------------------------------------------------------
  if (mode === 'custom') {
    const customBody = body as CustomBody
    if (!Array.isArray(customBody.slots) || customBody.slots.length === 0) {
      return badRequest('custom menus require at least one slot')
    }
    const result = await persistCustomMenu({
      admin,
      workspaceId,
      weekStartDate: customBody.weekStartDate,
      durationDays: clampDuration(customBody.durationDays),
      slots: customBody.slots,
      generationOptions: customBody.options as Record<string, unknown> | undefined,
    })
    if (!result.ok) {
      return jsonError(result.status, result.code, result.detail)
    }
    return jsonOk({ ok: true, menuId: result.menuId, mode: 'custom' })
  }

  // ---- Weekly (default) — engine-driven, deterministic -------------------
  const weeklyBody = body as WeeklyBody
  const loaded = await loadEngineSnapshot({ supabase: user.supabase, workspaceId })
  if (!loaded.ok) {
    if (loaded.reason === 'workspace_not_found') return notFound()
    if (loaded.reason === 'no_recipes') {
      return jsonError(
        412,
        'empty_workspace',
        'Create at least one recipe in this workspace before generating a menu.',
      )
    }
    return serverError(loaded.detail ?? 'failed to load engine snapshot')
  }

  const effectiveOverlay = computeEffectiveOverlay({
    raw: weeklyBody.options,
    members: loaded.members,
  })

  const seed = weeklyBody.seed ?? generateRandomSeed()
  const durationDays = clampDuration(weeklyBody.durationDays)
  const input: GenerateMenuInput = {
    workspace: loaded.workspace,
    members: loaded.members,
    recipes: loaded.recipes,
    ingredients: loaded.ingredients,
    weekStartDate: weeklyBody.weekStartDate,
    seed,
    durationDays,
    options: effectiveOverlay,
    now: new Date().toISOString(),
  }

  const result = await generateMenu(input)

  const persisted = await persistGeneratedMenu({
    admin,
    workspaceId,
    weekStartDate: weeklyBody.weekStartDate,
    input,
    result,
  })
  if (!persisted.ok) return serverError(persisted.detail)

  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: result.error,
        generationRunId: persisted.generationRunId,
      },
      { status: 422 },
    )
  }

  return jsonOk({
    ok: true,
    mode: 'weekly',
    menuId: persisted.menuId,
    inputsHash: result.inputsHash,
    seed,
    durationDays,
    effectiveOverlay,
    menu: result.menu,
    groceryLists: result.groceryLists,
  })
}
