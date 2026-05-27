import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recomputeGroceryListsForMenu } from './menu-grocery'

export type AcceptResult =
  | { ok: true; acceptedSeed: string }
  | { ok: false; status: number; code: string; detail: string }

// Compute a stable hash of the final accepted menu state (engine output +
// any user overrides) so two acceptances of the same menu produce the same
// accepted_seed — even when the engine RNG seed alone wouldn't (because the
// overrides aren't input to the engine).
//
// We hash the inputs_hash plus the canonical slot list (sorted, with
// recipe_id reflecting any overrides). A pristine acceptance therefore
// matches inputs_hash exactly only when there are zero overrides; a modified
// acceptance gets a different, but stable, identifier.
const computeAcceptedSeed = ({
  inputsHash,
  slots,
}: {
  inputsHash: string
  slots: Array<{
    day_of_week: string
    meal_key: string
    target_member_id: string | null
    recipe_id: string
  }>
}): string => {
  const sorted = [...slots].sort((a, b) => {
    const dayCmp = a.day_of_week.localeCompare(b.day_of_week)
    if (dayCmp !== 0) return dayCmp
    const keyCmp = a.meal_key.localeCompare(b.meal_key)
    if (keyCmp !== 0) return keyCmp
    return (a.target_member_id ?? '').localeCompare(b.target_member_id ?? '')
  })
  const canonical = JSON.stringify({
    inputsHash,
    slots: sorted.map((s) => ({
      d: s.day_of_week,
      k: s.meal_key,
      m: s.target_member_id,
      r: s.recipe_id,
    })),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

// Accept a draft menu:
//   1. Verify the menu exists, is not deleted, and is still a draft.
//   2. Compute accepted_seed from the final slot state.
//   3. In a single update, set accepted_at + accepted_seed.
//   4. Soft-delete the previously accepted menu for the same week (if any).
//   5. Build the grocery list children for the now-accepted menu by copying
//      from the original grocery_list that was created when the draft was
//      persisted. (The draft's grocery_items already reflect the engine
//      output — slot overrides done during review do NOT update the grocery
//      list in this iteration; that's a documented follow-up.)
export const acceptDraftMenu = async ({
  admin,
  workspaceId,
  menuId,
}: {
  admin: SupabaseClient
  workspaceId: string
  menuId: string
}): Promise<AcceptResult> => {
  const { data: menu, error: menuErr } = await admin
    .from('menus')
    .select(
      `id, workspace_id, week_start_date, inputs_hash, accepted_at, is_deleted,
       menu_slots (day_of_week, meal_key, target_member_id, recipe_id)`,
    )
    .eq('id', menuId)
    .maybeSingle()
  if (menuErr) {
    return { ok: false, status: 500, code: 'db_error', detail: menuErr.message }
  }
  if (!menu) {
    return { ok: false, status: 404, code: 'not_found', detail: 'menu not found' }
  }
  type MenuRow = {
    id: string
    workspace_id: string
    week_start_date: string
    inputs_hash: string
    accepted_at: string | null
    is_deleted: boolean
    menu_slots: Array<{
      day_of_week: string
      meal_key: string
      target_member_id: string | null
      recipe_id: string
    }>
  }
  const row = menu as MenuRow
  if (row.workspace_id !== workspaceId || row.is_deleted) {
    return { ok: false, status: 404, code: 'not_found', detail: 'menu not in workspace' }
  }
  if (row.accepted_at !== null) {
    return {
      ok: false,
      status: 409,
      code: 'already_accepted',
      detail: 'menu is already accepted',
    }
  }

  const acceptedSeed = computeAcceptedSeed({
    inputsHash: row.inputs_hash,
    slots: row.menu_slots,
  })

  // Soft-delete any other accepted menu for the same (workspace, week) so the
  // partial unique index uq_menus_workspace_week_accepted accepts the update.
  const { error: superErr } = await admin
    .from('menus')
    .update({ is_deleted: true })
    .eq('workspace_id', workspaceId)
    .eq('week_start_date', row.week_start_date)
    .eq('is_deleted', false)
    .not('accepted_at', 'is', null)
    .neq('id', menuId)
  if (superErr) {
    return { ok: false, status: 500, code: 'db_error', detail: superErr.message }
  }

  const { error: updErr } = await admin
    .from('menus')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_seed: acceptedSeed,
    })
    .eq('id', menuId)
  if (updErr) {
    return { ok: false, status: 500, code: 'db_error', detail: updErr.message }
  }

  // Rebuild the shared grocery list from the menu's final slots so any
  // per-slot overrides (or the empty list created for custom menus) are
  // reflected before the user lands on /grocery. Failures here surface as
  // db_error rather than rolling acceptance back — the accepted_at row is
  // the source of truth; a stale grocery list is recoverable, an
  // un-accepted menu after a successful UI click is not.
  const groceryResult = await recomputeGroceryListsForMenu({ admin, menuId })
  if (!groceryResult.ok) {
    return { ok: false, status: 500, code: 'db_error', detail: groceryResult.detail }
  }

  return { ok: true, acceptedSeed }
}

export const __test__ = { computeAcceptedSeed }
