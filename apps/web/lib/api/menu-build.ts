import type { SupabaseClient } from '@supabase/supabase-js'

export type BuildResult =
  | { ok: true; menuId: string }
  | { ok: false; status: number; code: string; detail: string }

const DAY_BY_JS_INDEX = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

const deriveStartDayOfWeek = (weekStartDate: string): string => {
  const [y, m, d] = weekStartDate.split('-').map((p) => Number.parseInt(p, 10))
  if (!y || !m || !d) return 'monday'
  return DAY_BY_JS_INDEX[new Date(y, m - 1, d).getDay()] ?? 'monday'
}

export type CustomSlotInput = {
  dayOfWeek: string
  mealKey: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId: string
  targetMemberId: string | null
}

// Replace any outstanding draft for (workspace, week) — same invariant the
// engine-generated path follows. The accepted menu (if any) is untouched.
const replaceOutstandingDraft = async ({
  admin,
  workspaceId,
  weekStartDate,
}: {
  admin: SupabaseClient
  workspaceId: string
  weekStartDate: string
}): Promise<{ ok: true } | { ok: false; detail: string }> => {
  const { error } = await admin
    .from('menus')
    .update({ is_deleted: true })
    .eq('workspace_id', workspaceId)
    .eq('week_start_date', weekStartDate)
    .eq('is_deleted', false)
    .is('accepted_at', null)
  if (error) return { ok: false, detail: error.message }
  return { ok: true }
}

// Build a custom (non-deterministic, user-defined) menu as a new draft.
// Custom menus skip the engine entirely — every slot is user-supplied. The
// only validation we do server-side is that recipes belong to the workspace
// and meal_type matches the slot's meal_type. Allergy/dietary validation is
// deferred: a "custom" menu means the user is taking responsibility for the
// constraint set, but we still record any per-menu overlay for audit.
export const persistCustomMenu = async ({
  admin,
  workspaceId,
  weekStartDate,
  durationDays,
  slots,
  generationOptions,
}: {
  admin: SupabaseClient
  workspaceId: string
  weekStartDate: string
  durationDays: number
  slots: CustomSlotInput[]
  generationOptions?: Record<string, unknown>
}): Promise<BuildResult> => {
  if (slots.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'empty_menu',
      detail: 'A custom menu needs at least one slot.',
    }
  }
  const recipeIds = Array.from(new Set(slots.map((s) => s.recipeId)))
  const { data: recipeRows, error: recErr } = await admin
    .from('recipes')
    .select('id, meal_type')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .in('id', recipeIds)
  if (recErr) {
    return { ok: false, status: 500, code: 'db_error', detail: recErr.message }
  }
  const recipeMealType = new Map<string, string>()
  for (const row of (recipeRows ?? []) as Array<{ id: string; meal_type: string }>) {
    recipeMealType.set(row.id, row.meal_type)
  }
  for (const slot of slots) {
    const expected = recipeMealType.get(slot.recipeId)
    if (!expected) {
      return {
        ok: false,
        status: 400,
        code: 'unknown_recipe',
        detail: `Recipe ${slot.recipeId} not found in this workspace.`,
      }
    }
    if (expected !== slot.mealType) {
      return {
        ok: false,
        status: 422,
        code: 'meal_type_mismatch',
        detail: `Recipe ${slot.recipeId} is a ${expected} recipe; slot expected ${slot.mealType}.`,
      }
    }
  }

  const replaced = await replaceOutstandingDraft({
    admin,
    workspaceId,
    weekStartDate,
  })
  if (!replaced.ok) {
    return { ok: false, status: 500, code: 'db_error', detail: replaced.detail }
  }

  const { data: menuRow, error: menuErr } = await admin
    .from('menus')
    .insert({
      workspace_id: workspaceId,
      week_start_date: weekStartDate,
      seed: null,
      inputs_hash: null,
      generation_options: generationOptions ?? null,
      menu_type: 'custom',
      duration_days: durationDays,
      start_day_of_week: deriveStartDayOfWeek(weekStartDate),
    })
    .select('id')
    .single()
  if (menuErr || !menuRow) {
    return {
      ok: false,
      status: 500,
      code: 'db_error',
      detail: menuErr?.message ?? 'menu insert failed',
    }
  }
  const menuId = (menuRow as { id: string }).id
  const { error: slotErr } = await admin.from('menu_slots').insert(
    slots.map((slot) => ({
      menu_id: menuId,
      day_of_week: slot.dayOfWeek,
      meal_key: slot.mealKey,
      meal_type: slot.mealType,
      recipe_id: slot.recipeId,
      target_member_id: slot.targetMemberId,
    })),
  )
  if (slotErr) {
    return { ok: false, status: 500, code: 'db_error', detail: slotErr.message }
  }
  // Custom menus get an empty shared grocery list at creation; populated on
  // acceptance once we wire grocery recomputation. For now, accept just
  // promotes the menu with whatever shared list exists.
  const { error: listErr } = await admin
    .from('grocery_lists')
    .insert({ menu_id: menuId, target_member_id: null })
  if (listErr) {
    return { ok: false, status: 500, code: 'db_error', detail: listErr.message }
  }
  return { ok: true, menuId }
}

// Clone an existing menu's slots into a fresh draft. Preserves engine seed,
// inputs_hash, generation_options, duration, start_day so a "pristine"
// regeneration could reproduce it; the cloned_from_menu_id link records
// provenance for the history view.
export const cloneMenuAsDraft = async ({
  admin,
  workspaceId,
  sourceMenuId,
  weekStartDate,
}: {
  admin: SupabaseClient
  workspaceId: string
  sourceMenuId: string
  weekStartDate: string
}): Promise<BuildResult> => {
  const { data: srcRow, error: srcErr } = await admin
    .from('menus')
    .select(
      `id, workspace_id, week_start_date, seed, inputs_hash, generation_options,
       menu_type, duration_days, start_day_of_week, accepted_at, is_deleted,
       menu_slots (day_of_week, meal_key, meal_type, recipe_id, target_member_id)`,
    )
    .eq('id', sourceMenuId)
    .maybeSingle()
  if (srcErr) {
    return { ok: false, status: 500, code: 'db_error', detail: srcErr.message }
  }
  if (!srcRow) {
    return { ok: false, status: 404, code: 'not_found', detail: 'source menu not found' }
  }
  type Source = {
    id: string
    workspace_id: string
    week_start_date: string
    seed: number | null
    inputs_hash: string | null
    generation_options: unknown
    menu_type: 'weekly' | 'custom'
    duration_days: number
    start_day_of_week: string
    accepted_at: string | null
    is_deleted: boolean
    menu_slots: Array<{
      day_of_week: string
      meal_key: string
      meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
      recipe_id: string
      target_member_id: string | null
    }>
  }
  const src = srcRow as Source
  if (src.workspace_id !== workspaceId || src.is_deleted) {
    return { ok: false, status: 404, code: 'not_found', detail: 'menu not in workspace' }
  }
  if (src.accepted_at === null) {
    return {
      ok: false,
      status: 422,
      code: 'source_not_accepted',
      detail: 'Only accepted menus can be cloned.',
    }
  }

  const replaced = await replaceOutstandingDraft({
    admin,
    workspaceId,
    weekStartDate,
  })
  if (!replaced.ok) {
    return { ok: false, status: 500, code: 'db_error', detail: replaced.detail }
  }

  const { data: newRow, error: insErr } = await admin
    .from('menus')
    .insert({
      workspace_id: workspaceId,
      week_start_date: weekStartDate,
      seed: src.seed,
      inputs_hash: src.inputs_hash,
      generation_options: src.generation_options ?? null,
      menu_type: src.menu_type,
      duration_days: src.duration_days,
      start_day_of_week: deriveStartDayOfWeek(weekStartDate),
      cloned_from_menu_id: src.id,
    })
    .select('id')
    .single()
  if (insErr || !newRow) {
    return {
      ok: false,
      status: 500,
      code: 'db_error',
      detail: insErr?.message ?? 'menu insert failed',
    }
  }
  const newMenuId = (newRow as { id: string }).id

  if (src.menu_slots.length > 0) {
    const { error: slotErr } = await admin.from('menu_slots').insert(
      src.menu_slots.map((s) => ({
        menu_id: newMenuId,
        day_of_week: s.day_of_week,
        meal_key: s.meal_key,
        meal_type: s.meal_type,
        recipe_id: s.recipe_id,
        target_member_id: s.target_member_id,
      })),
    )
    if (slotErr) {
      return { ok: false, status: 500, code: 'db_error', detail: slotErr.message }
    }
  }

  const { error: listErr } = await admin
    .from('grocery_lists')
    .insert({ menu_id: newMenuId, target_member_id: null })
  if (listErr) {
    return { ok: false, status: 500, code: 'db_error', detail: listErr.message }
  }
  return { ok: true, menuId: newMenuId }
}
