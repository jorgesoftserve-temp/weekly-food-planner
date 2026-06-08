import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GenerateMenuInput,
  GenerateMenuOptions,
} from '@weekly-food-planner/constraint-engine'
import { loadEngineSnapshot } from './menu-loader'
import { computeEffectiveOverlay, type RawOverlay } from './menu-overlay'

export type WeeklyBuildBody = {
  weekStartDate: string
  seed?: number
  durationDays?: number
  options?: RawOverlay
  participantMemberIds?: string[]
}

export type BuildWeeklyEngineInputResult =
  | {
      ok: true
      input: GenerateMenuInput
      participantMemberIds: string[]
      effectiveOverlay: GenerateMenuOptions | undefined
      seed: number
      durationDays: number
    }
  | { ok: false; status: number; code: string; detail: string }

const MAX_SEED = 2_147_483_647

const generateRandomSeed = (): number => Math.floor(Math.random() * MAX_SEED)

const clampDuration = (raw: number | undefined): number => {
  if (raw === undefined || raw === null) return 7
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 7
  return Math.max(1, Math.min(7, n))
}

// Shared builder for both the persisting `POST /menus` (weekly mode) and the
// upcoming non-persisting `POST /menus/preview`. Keeping a single source of
// truth for overlay dedup + participant filtering + frequency cascade prevents
// drift between the draft path and the preview path.
//
// Auth is the caller's responsibility — this helper assumes the caller already
// verified the user has admin role on the workspace. `supabase` is the user-
// scoped client (RLS applies), used here only to fetch the snapshot.
export const buildWeeklyEngineInput = async ({
  supabase,
  workspaceId,
  body,
  nowIso,
}: {
  supabase: SupabaseClient
  workspaceId: string
  body: WeeklyBuildBody
  // Caller-supplied "now" so the engine boundary stays free of `new Date()`
  // at the engine layer. Route handlers default this to the request time.
  nowIso: string
}): Promise<BuildWeeklyEngineInputResult> => {
  const loaded = await loadEngineSnapshot({ supabase, workspaceId })
  if (!loaded.ok) {
    if (loaded.reason === 'workspace_not_found') {
      return { ok: false, status: 404, code: 'not_found', detail: 'workspace not found' }
    }
    if (loaded.reason === 'no_recipes') {
      return {
        ok: false,
        status: 412,
        code: 'empty_workspace',
        detail:
          'Create at least one recipe in this workspace before generating a menu.',
      }
    }
    return {
      ok: false,
      status: 500,
      code: 'snapshot_load_failed',
      detail: loaded.detail ?? 'failed to load engine snapshot',
    }
  }

  const allMemberIds = new Set(loaded.members.map((m) => m.id))
  const requestedIds = Array.isArray(body.participantMemberIds)
    ? Array.from(new Set(body.participantMemberIds))
    : null
  if (requestedIds && requestedIds.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_participants',
      detail: 'participantMemberIds cannot be empty',
    }
  }
  const participantMemberIds = requestedIds
    ? requestedIds.filter((id) => allMemberIds.has(id))
    : loaded.members.map((m) => m.id)
  if (participantMemberIds.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_participants',
      detail: 'no valid participants for this workspace',
    }
  }
  const participantIdSet = new Set(participantMemberIds)
  const participatingMembers = loaded.members.filter((m) =>
    participantIdSet.has(m.id),
  )

  const effectiveOverlay = computeEffectiveOverlay({
    raw: body.options,
    members: participatingMembers,
  })

  const seed = body.seed ?? generateRandomSeed()
  const durationDays = clampDuration(body.durationDays)

  const input: GenerateMenuInput = {
    workspace: loaded.workspace,
    members: participatingMembers,
    recipes: loaded.recipes,
    ingredients: loaded.ingredients,
    weekStartDate: body.weekStartDate,
    seed,
    durationDays,
    options: effectiveOverlay,
    now: nowIso,
  }

  return {
    ok: true,
    input,
    participantMemberIds,
    effectiveOverlay,
    seed,
    durationDays,
  }
}
