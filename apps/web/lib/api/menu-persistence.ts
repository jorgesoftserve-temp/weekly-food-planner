import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GenerateMenuInput,
  GenerateMenuResult,
} from '@weekly-food-planner/constraint-engine'

export type PersistResult =
  | { ok: true; menuId: string | null; generationRunId: string }
  | { ok: false; detail: string }

const DAY_BY_JS_INDEX = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

// Mirror of the engine's day-of-week derivation in slots.ts. Local-time
// interpretation matches the engine's timezone-naive convention.
const deriveStartDayOfWeek = (weekStartDate: string): string => {
  const [y, m, d] = weekStartDate.split('-').map((part) => Number.parseInt(part, 10))
  if (!y || !m || !d) return 'monday'
  return DAY_BY_JS_INDEX[new Date(y, m - 1, d).getDay()] ?? 'monday'
}

// Step 29 — Drafts coexist with accepted menus.
// On a successful generation:
//   1. Soft-delete any prior DRAFT for the same (workspace, week). The
//      accepted menu (if any) is left untouched.
//   2. Insert the new menu as a draft (accepted_at = NULL).
//   3. Insert slots + grocery list + items + a success generation_run.
//
// On a failed generation the prior draft is NOT replaced — the user keeps
// whatever they were last reviewing.
//
// Acceptance (promoting a draft to active) is a separate code path —
// `lib/api/menu-accept.ts`.
export const persistGeneratedMenu = async ({
  admin,
  workspaceId,
  weekStartDate,
  input,
  result,
}: {
  admin: SupabaseClient
  workspaceId: string
  weekStartDate: string
  input: GenerateMenuInput
  result: GenerateMenuResult
}): Promise<PersistResult> => {
  if (!result.ok) {
    const { data: runRow, error: runErr } = await admin
      .from('generation_runs')
      .insert({
        workspace_id: workspaceId,
        seed: input.seed,
        inputs_hash: '',
        status: 'failed',
        error_payload: result.error,
        finished_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (runErr || !runRow) {
      return { ok: false, detail: runErr?.message ?? 'failed-run insert failed' }
    }
    return { ok: true, menuId: null, generationRunId: (runRow as { id: string }).id }
  }

  // Replace any outstanding draft for this (workspace, week). The partial
  // unique index on (workspace, week) WHERE accepted_at IS NULL would
  // otherwise reject the insert.
  const { error: softDelErr } = await admin
    .from('menus')
    .update({ is_deleted: true })
    .eq('workspace_id', workspaceId)
    .eq('week_start_date', weekStartDate)
    .eq('is_deleted', false)
    .is('accepted_at', null)
  if (softDelErr) return { ok: false, detail: softDelErr.message }

  // Derive start_day_of_week from weekStartDate so the DB row carries it
  // directly (history queries don't have to recompute from the date). The
  // engine uses the same derivation in enumerateMenuDays.
  const startDayOfWeek = deriveStartDayOfWeek(weekStartDate)
  const { data: menuRow, error: menuErr } = await admin
    .from('menus')
    .insert({
      workspace_id: workspaceId,
      week_start_date: weekStartDate,
      seed: input.seed,
      inputs_hash: result.inputsHash,
      generation_options: input.options ?? null,
      menu_type: 'weekly',
      duration_days: input.durationDays ?? 7,
      start_day_of_week: startDayOfWeek,
      // accepted_at + accepted_seed stay NULL until the user accepts.
    })
    .select('id')
    .single()
  if (menuErr || !menuRow) {
    return { ok: false, detail: menuErr?.message ?? 'menu insert failed' }
  }
  const menuId = (menuRow as { id: string }).id

  if (result.menu.slots.length > 0) {
    const { error: slotErr } = await admin.from('menu_slots').insert(
      result.menu.slots.map((slot) => ({
        menu_id: menuId,
        day_of_week: slot.dayOfWeek,
        meal_key: slot.mealKey,
        meal_type: slot.mealType,
        recipe_id: slot.recipeId,
        target_member_id: slot.targetMemberId,
        // is_overridden defaults to false; original_recipe_id stays NULL
        // until/unless the user replaces this slot during draft review.
      })),
    )
    if (slotErr) return { ok: false, detail: slotErr.message }
  }

  const { data: listRow, error: listErr } = await admin
    .from('grocery_lists')
    .insert({ menu_id: menuId, target_member_id: null })
    .select('id')
    .single()
  if (listErr || !listRow) {
    return { ok: false, detail: listErr?.message ?? 'grocery list insert failed' }
  }
  const listId = (listRow as { id: string }).id

  if (result.groceryLists.shared.items.length > 0) {
    const { error: itemErr } = await admin.from('grocery_items').insert(
      result.groceryLists.shared.items.map((item) => ({
        list_id: listId,
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
        scheduled_purchase_day: item.scheduledPurchaseDay,
      })),
    )
    if (itemErr) return { ok: false, detail: itemErr.message }
  }

  const { data: runRow, error: runErr } = await admin
    .from('generation_runs')
    .insert({
      menu_id: menuId,
      workspace_id: workspaceId,
      seed: input.seed,
      inputs_hash: result.inputsHash,
      status: 'success',
      finished_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (runErr || !runRow) {
    return { ok: false, detail: runErr?.message ?? 'success-run insert failed' }
  }

  return { ok: true, menuId, generationRunId: (runRow as { id: string }).id }
}
