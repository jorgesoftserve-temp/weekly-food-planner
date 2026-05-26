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
  // Subset of household members this menu is for. Defaults to every active
  // member when omitted/empty. See PRODUCT_PRD §4.3.
  participantMemberIds?: string[]
}

type CustomBody = {
  mode: 'custom'
  weekStartDate: string
  durationDays?: number
  slots: CustomSlotInput[]
  options?: RawOverlay
  participantMemberIds?: string[]
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

  // Resolve the participant snapshot for both weekly and custom modes. An
  // explicit empty list means "for nobody" which doesn't make sense — reject
  // with a 400 so the user picks at least one. Omitted/undefined falls back
  // to "every active workspace member" so legacy callers keep working.
  const resolveParticipantIds = async (
    raw: string[] | undefined,
  ): Promise<{ ok: true; ids: string[] } | { ok: false; detail: string }> => {
    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        return { ok: false, detail: 'participantMemberIds cannot be empty' }
      }
      return { ok: true, ids: Array.from(new Set(raw)) }
    }
    const { data, error } = await user.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('is_deleted', false)
    if (error) return { ok: false, detail: error.message }
    const rows = (data ?? []) as Array<{ id: string }>
    return { ok: true, ids: rows.map((r) => r.id) }
  }

  // ---- Custom mode -------------------------------------------------------
  if (mode === 'custom') {
    const customBody = body as CustomBody
    if (!Array.isArray(customBody.slots) || customBody.slots.length === 0) {
      return badRequest('custom menus require at least one slot')
    }
    const participants = await resolveParticipantIds(customBody.participantMemberIds)
    if (!participants.ok) return badRequest(participants.detail)
    const result = await persistCustomMenu({
      admin,
      workspaceId,
      weekStartDate: customBody.weekStartDate,
      durationDays: clampDuration(customBody.durationDays),
      slots: customBody.slots,
      generationOptions: customBody.options as Record<string, unknown> | undefined,
      participantMemberIds: participants.ids,
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

  // Filter to participants before the engine sees the member set. Anything
  // outside the workspace's active members is dropped — the user can only
  // generate a menu for people who actually belong here.
  const allMemberIds = new Set(loaded.members.map((m) => m.id))
  const requestedIds = Array.isArray(weeklyBody.participantMemberIds)
    ? Array.from(new Set(weeklyBody.participantMemberIds))
    : null
  if (requestedIds && requestedIds.length === 0) {
    return badRequest('participantMemberIds cannot be empty')
  }
  const participantIds = requestedIds
    ? requestedIds.filter((id) => allMemberIds.has(id))
    : loaded.members.map((m) => m.id)
  if (participantIds.length === 0) {
    return badRequest('no valid participants for this workspace')
  }
  const participantIdSet = new Set(participantIds)
  const participatingMembers = loaded.members.filter((m) => participantIdSet.has(m.id))

  // computeEffectiveOverlay also vets memberFrequencyOverrides against the
  // participant set, so unknown / non-participating ids in overrides are
  // silently dropped from the persisted options.
  const effectiveOverlay = computeEffectiveOverlay({
    raw: weeklyBody.options,
    members: participatingMembers,
  })

  const seed = weeklyBody.seed ?? generateRandomSeed()
  const durationDays = clampDuration(weeklyBody.durationDays)
  const input: GenerateMenuInput = {
    workspace: loaded.workspace,
    members: participatingMembers,
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
    participantMemberIds: participantIds,
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
