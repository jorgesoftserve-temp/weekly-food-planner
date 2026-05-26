import type { SupabaseClient } from '@supabase/supabase-js'

export type RecomputeResult =
  | { ok: true; listId: string; itemCount: number }
  | { ok: false; detail: string }

// Recompute the menu's shared grocery list from the current menu_slots +
// recipe_ingredients. Called on acceptance so the grocery view reflects
// whatever the user actually accepted, including any per-slot overrides
// from draft review. Per-member grocery lists are out of scope for this
// pass — we only maintain the shared list (target_member_id IS NULL),
// matching what menu-persistence and persistCustomMenu produce today.
//
// Strategy:
//   1. Load the menu's slots → recipe ids.
//   2. Load recipe_ingredients for those recipes.
//   3. Aggregate by (ingredient_id, unit) summing quantities.
//   4. Delete existing grocery_items under the menu's shared grocery_list.
//   5. Insert the aggregated rows.
//
// scheduled_purchase_day is left NULL. The engine's freshness scheduling
// runs at generation time and isn't reproducible from DB-only inputs
// without re-running the loader; honoring freshness on override is a
// follow-up.
export const recomputeGroceryListForMenu = async ({
  admin,
  menuId,
}: {
  admin: SupabaseClient
  menuId: string
}): Promise<RecomputeResult> => {
  const { data: slots, error: slotsErr } = await admin
    .from('menu_slots')
    .select('recipe_id')
    .eq('menu_id', menuId)
  if (slotsErr) return { ok: false, detail: slotsErr.message }
  const recipeIds = Array.from(
    new Set(((slots ?? []) as Array<{ recipe_id: string }>).map((s) => s.recipe_id)),
  )

  type Aggregate = { ingredient_id: string; unit: string; quantity: number }
  const agg = new Map<string, Aggregate>()
  if (recipeIds.length > 0) {
    const { data: rows, error: riErr } = await admin
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id, quantity, unit')
      .in('recipe_id', recipeIds)
    if (riErr) return { ok: false, detail: riErr.message }
    // Count occurrences of each recipe across slots — a recipe used twice
    // contributes twice as much of each ingredient.
    const occurrences = new Map<string, number>()
    for (const s of (slots ?? []) as Array<{ recipe_id: string }>) {
      occurrences.set(s.recipe_id, (occurrences.get(s.recipe_id) ?? 0) + 1)
    }
    type Row = {
      recipe_id: string
      ingredient_id: string
      quantity: string | number
      unit: string
    }
    for (const row of (rows ?? []) as Row[]) {
      const multiplier = occurrences.get(row.recipe_id) ?? 0
      if (multiplier === 0) continue
      const qty =
        (typeof row.quantity === 'string'
          ? Number.parseFloat(row.quantity)
          : row.quantity) * multiplier
      if (!Number.isFinite(qty)) continue
      const key = `${row.ingredient_id}::${row.unit}`
      const existing = agg.get(key)
      if (existing) existing.quantity += qty
      else
        agg.set(key, {
          ingredient_id: row.ingredient_id,
          unit: row.unit,
          quantity: qty,
        })
    }
  }

  // Locate (or create) the shared grocery list for this menu. Both the
  // engine-persist path and persistCustomMenu insert one at creation, so
  // this is almost always a read; we tolerate its absence to keep the
  // function safe for older rows.
  const { data: existingList, error: getListErr } = await admin
    .from('grocery_lists')
    .select('id')
    .eq('menu_id', menuId)
    .is('target_member_id', null)
    .maybeSingle()
  if (getListErr) return { ok: false, detail: getListErr.message }

  let listId: string
  if (existingList) {
    listId = (existingList as { id: string }).id
  } else {
    const { data: inserted, error: insListErr } = await admin
      .from('grocery_lists')
      .insert({ menu_id: menuId, target_member_id: null })
      .select('id')
      .single()
    if (insListErr || !inserted) {
      return {
        ok: false,
        detail: insListErr?.message ?? 'failed to insert grocery_list',
      }
    }
    listId = (inserted as { id: string }).id
  }

  // Clear out whatever items were there from generation time. We're
  // rebuilding from the (possibly overridden) slots.
  const { error: delErr } = await admin
    .from('grocery_items')
    .delete()
    .eq('list_id', listId)
  if (delErr) return { ok: false, detail: delErr.message }

  const itemRows = Array.from(agg.values()).map((a) => ({
    list_id: listId,
    ingredient_id: a.ingredient_id,
    quantity: a.quantity,
    unit: a.unit,
    scheduled_purchase_day: null,
  }))

  if (itemRows.length > 0) {
    const { error: insErr } = await admin
      .from('grocery_items')
      .insert(itemRows)
    if (insErr) return { ok: false, detail: insErr.message }
  }

  return { ok: true, listId, itemCount: itemRows.length }
}
