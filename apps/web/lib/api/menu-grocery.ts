import type { SupabaseClient } from '@supabase/supabase-js'

export type RecomputeResult =
  | { ok: true; listIds: string[]; itemCount: number }
  | { ok: false; detail: string }

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

const DAY_INDEX: Record<DayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

// Build the menu's calendar order — wraps past Sunday → Monday so a menu
// starting Friday with duration 4 gets fri/sat/sun/mon. Mirrors the engine's
// enumerateMenuDays without depending on the package (server-only path).
const buildDayOrder = ({
  startDayOfWeek,
  durationDays,
}: {
  startDayOfWeek: string
  durationDays: number
}): Map<string, number> => {
  const order = new Map<string, number>()
  const startIdx =
    (DAY_INDEX as Record<string, number | undefined>)[startDayOfWeek] ?? 0
  const clamped = Math.max(1, Math.min(7, Math.floor(durationDays)))
  for (let i = 0; i < clamped; i++) {
    const day = DAYS_OF_WEEK[(startIdx + i) % 7]
    if (day) order.set(day, i)
  }
  return order
}

// Recompute every grocery list (shared + per-member) belonging to the given
// menu, from the live state of menu_slots + recipe_ingredients. Called on
// acceptance so the grocery view reflects whatever the user actually
// accepted, including any per-slot overrides from draft review.
//
// Buckets:
//   - "shared" (target_member_id IS NULL): aggregates every slot, so the
//     master list shows the total to buy across the household.
//   - per-member: aggregates only slots whose target_member_id equals that
//     member id. Slots with target_member_id IS NULL contribute only to
//     the shared bucket (matches the custom-menu UX).
//
// scheduled_purchase_day:
//   For perishable ingredients, set to the EARLIEST day-of-week in the
//   menu's calendar order on which the ingredient is used. For
//   non-perishable, left NULL (buy anytime). This honours the engine's
//   freshness intent without re-running the full engine: same-day-cook and
//   requires-fresh ingredients land on their usage day; merely-perishable
//   ingredients also land on first-use day so the user front-loads their
//   shopping when storage life is short. Future work can shift purchase
//   earlier by max_storage_days if the menu has enough buffer days.
//
// Strategy:
//   1. Load menu (start_day_of_week, duration_days) so we can order days.
//   2. Load slots → recipe ids + day_of_week + target_member_id.
//   3. Load recipe_ingredients for those recipes.
//   4. Load ingredients to know perishability.
//   5. Aggregate per (bucket, ingredient, unit), tracking earliest day idx.
//   6. Replace grocery_lists + grocery_items for the menu (delete + insert).
export const recomputeGroceryListsForMenu = async ({
  admin,
  menuId,
}: {
  admin: SupabaseClient
  menuId: string
}): Promise<RecomputeResult> => {
  const { data: menuRow, error: menuErr } = await admin
    .from('menus')
    .select('start_day_of_week, duration_days')
    .eq('id', menuId)
    .maybeSingle()
  if (menuErr) return { ok: false, detail: menuErr.message }
  if (!menuRow) {
    return { ok: false, detail: 'menu not found' }
  }
  const menu = menuRow as { start_day_of_week: string; duration_days: number }
  const dayOrder = buildDayOrder({
    startDayOfWeek: menu.start_day_of_week,
    durationDays: menu.duration_days,
  })

  // participantCount drives the eaters denominator for custom-mode NULL-target
  // (shared) slots. Engine-produced menus only emit per-member slots, so the
  // count doesn't change their math — every per-member slot contributes 1
  // eater. We still load the count to handle custom menus correctly.
  // Falls back to 1 if the menu somehow has no participants (legacy rows
  // before the backfill, or RLS quirks) so we avoid divide-by-zero math and
  // bad data surfaces as raw quantities rather than NaN.
  const { count: participantCount, error: partErr } = await admin
    .from('menu_participants')
    .select('member_id', { count: 'exact', head: true })
    .eq('menu_id', menuId)
  if (partErr) return { ok: false, detail: partErr.message }
  const eatersForSharedSlot = Math.max(1, participantCount ?? 1)

  const { data: slotRows, error: slotsErr } = await admin
    .from('menu_slots')
    .select('recipe_id, target_member_id, day_of_week')
    .eq('menu_id', menuId)
  if (slotsErr) return { ok: false, detail: slotsErr.message }
  type SlotRow = {
    recipe_id: string
    target_member_id: string | null
    day_of_week: string
  }
  const slots = (slotRows ?? []) as SlotRow[]

  const recipeIds = Array.from(new Set(slots.map((s) => s.recipe_id)))
  type IngredientRow = {
    id: string
    is_perishable: boolean
    max_storage_days: number | null
    requires_fresh: boolean
    same_day_cook: boolean
  }
  type RecipeIngRow = {
    recipe_id: string
    ingredient_id: string
    quantity: string | number
    unit: string
  }
  const recipeIngsByRecipe = new Map<string, RecipeIngRow[]>()
  const ingredientIds = new Set<string>()
  if (recipeIds.length > 0) {
    const { data: riRows, error: riErr } = await admin
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id, quantity, unit')
      .in('recipe_id', recipeIds)
    if (riErr) return { ok: false, detail: riErr.message }
    for (const row of (riRows ?? []) as RecipeIngRow[]) {
      const list = recipeIngsByRecipe.get(row.recipe_id) ?? []
      list.push(row)
      recipeIngsByRecipe.set(row.recipe_id, list)
      ingredientIds.add(row.ingredient_id)
    }
  }

  // Recipe servings drive the cook-once scaling factor (PRODUCT_PRD §7).
  // The DB enforces CHECK (servings > 0) at the recipes table, but we guard
  // against 0/missing here too — a fallback of 1 yields raw quantities,
  // which is the right "do no harm" behaviour for bad data.
  const servingsByRecipe = new Map<string, number>()
  if (recipeIds.length > 0) {
    const { data: recipeRows, error: recipeErr } = await admin
      .from('recipes')
      .select('id, servings')
      .in('id', recipeIds)
    if (recipeErr) return { ok: false, detail: recipeErr.message }
    for (const row of (recipeRows ?? []) as Array<{ id: string; servings: number }>) {
      servingsByRecipe.set(row.id, row.servings > 0 ? row.servings : 1)
    }
  }

  const perishableById = new Map<string, boolean>()
  if (ingredientIds.size > 0) {
    const { data: ingRows, error: ingErr } = await admin
      .from('ingredients')
      .select('id, is_perishable, max_storage_days, requires_fresh, same_day_cook')
      .in('id', Array.from(ingredientIds))
    if (ingErr) return { ok: false, detail: ingErr.message }
    for (const row of (ingRows ?? []) as IngredientRow[]) {
      // Anything perishable / requires-fresh / same-day-cook needs a
      // scheduled purchase day. Treat any of those three as "needs a day".
      perishableById.set(
        row.id,
        row.is_perishable || row.requires_fresh || row.same_day_cook,
      )
    }
  }

  type Aggregate = {
    ingredient_id: string
    unit: string
    quantity: number
    earliestDayIdx: number
  }
  // Bucket key: 'shared' | `m:${memberId}`. Map<bucketKey, Map<itemKey, Aggregate>>.
  const buckets = new Map<string, Map<string, Aggregate>>()
  const ensureBucket = (key: string): Map<string, Aggregate> => {
    const existing = buckets.get(key)
    if (existing) return existing
    const fresh = new Map<string, Aggregate>()
    buckets.set(key, fresh)
    return fresh
  }

  const addToBucket = ({
    bucketKey,
    ingredientId,
    unit,
    quantity,
    dayIdx,
  }: {
    bucketKey: string
    ingredientId: string
    unit: string
    quantity: number
    dayIdx: number
  }): void => {
    const bucket = ensureBucket(bucketKey)
    const itemKey = `${ingredientId}::${unit}`
    const existing = bucket.get(itemKey)
    if (existing) {
      existing.quantity += quantity
      if (dayIdx < existing.earliestDayIdx) existing.earliestDayIdx = dayIdx
    } else {
      bucket.set(itemKey, {
        ingredient_id: ingredientId,
        unit,
        quantity,
        earliestDayIdx: dayIdx,
      })
    }
  }

  for (const slot of slots) {
    const dayIdx = dayOrder.get(slot.day_of_week) ?? 99
    const recipeIngs = recipeIngsByRecipe.get(slot.recipe_id) ?? []
    const servings = servingsByRecipe.get(slot.recipe_id) ?? 1
    // Cook-once scaling (PRODUCT_PRD §7). Each slot contributes
    // (recipe_ingredient.quantity * eaters / recipe.servings) — i.e. cook
    // enough of the recipe to feed the slot's eaters.
    //   - per-member slot (target_member_id IS NOT NULL): eaters = 1.
    //   - shared slot (target_member_id IS NULL, custom mode only): eaters
    //     = participantCount, because the cook event feeds the household.
    // The shared bucket sums every slot's contribution → total to buy.
    // The per-member bucket only sees member-targeted slots → that person's
    // individual allocation; NULL-target slots don't belong to any one
    // person's bucket.
    const eatersForShared = slot.target_member_id
      ? 1
      : eatersForSharedSlot
    const scaleForShared = eatersForShared / servings
    const scaleForMember = 1 / servings
    for (const ri of recipeIngs) {
      const qty =
        typeof ri.quantity === 'string'
          ? Number.parseFloat(ri.quantity)
          : ri.quantity
      if (!Number.isFinite(qty)) continue
      addToBucket({
        bucketKey: 'shared',
        ingredientId: ri.ingredient_id,
        unit: ri.unit,
        quantity: qty * scaleForShared,
        dayIdx,
      })
      if (slot.target_member_id) {
        addToBucket({
          bucketKey: `m:${slot.target_member_id}`,
          ingredientId: ri.ingredient_id,
          unit: ri.unit,
          quantity: qty * scaleForMember,
          dayIdx,
        })
      }
    }
  }

  // Inverse: dayIdx → dayOfWeek, so we can write the human-readable day
  // back to grocery_items.scheduled_purchase_day.
  const dayByIdx = new Map<number, string>()
  for (const [day, idx] of dayOrder) dayByIdx.set(idx, day)

  // Wipe the menu's grocery lists + items and rebuild. grocery_items has ON
  // DELETE CASCADE from grocery_lists in the schema; we still delete items
  // explicitly so we don't depend on that for behavior here.
  const { data: existingLists, error: getListsErr } = await admin
    .from('grocery_lists')
    .select('id')
    .eq('menu_id', menuId)
  if (getListsErr) return { ok: false, detail: getListsErr.message }
  const existingListIds = ((existingLists ?? []) as Array<{ id: string }>).map(
    (l) => l.id,
  )
  if (existingListIds.length > 0) {
    const { error: delItemsErr } = await admin
      .from('grocery_items')
      .delete()
      .in('list_id', existingListIds)
    if (delItemsErr) return { ok: false, detail: delItemsErr.message }
    const { error: delListsErr } = await admin
      .from('grocery_lists')
      .delete()
      .eq('menu_id', menuId)
    if (delListsErr) return { ok: false, detail: delListsErr.message }
  }

  // Insert one grocery_lists row per non-empty bucket. We always insert the
  // shared list (even if empty) so the grocery page has something to render
  // and the "no items" empty state is reachable; per-member rows are only
  // inserted when they have at least one item.
  type BucketRow = { target_member_id: string | null; items: Aggregate[] }
  const bucketRows: BucketRow[] = []
  const sharedAgg = buckets.get('shared')
  bucketRows.push({
    target_member_id: null,
    items: sharedAgg ? Array.from(sharedAgg.values()) : [],
  })
  for (const [key, agg] of buckets) {
    if (key === 'shared') continue
    if (agg.size === 0) continue
    const memberId = key.slice(2)
    bucketRows.push({
      target_member_id: memberId,
      items: Array.from(agg.values()),
    })
  }

  const listIds: string[] = []
  let totalItems = 0
  for (const bucket of bucketRows) {
    const { data: inserted, error: insListErr } = await admin
      .from('grocery_lists')
      .insert({ menu_id: menuId, target_member_id: bucket.target_member_id })
      .select('id')
      .single()
    if (insListErr || !inserted) {
      return {
        ok: false,
        detail: insListErr?.message ?? 'failed to insert grocery_list',
      }
    }
    const listId = (inserted as { id: string }).id
    listIds.push(listId)

    if (bucket.items.length === 0) continue
    // grocery_items has CHECK (quantity > 0); drop any aggregates that sum
    // to zero so the insert doesn't blow up on a single bad row.
    const itemRows = bucket.items
      .filter((a) => a.quantity > 0)
      .map((a) => {
        const needsDay = perishableById.get(a.ingredient_id) ?? false
        const scheduledDay = needsDay
          ? dayByIdx.get(a.earliestDayIdx) ?? null
          : null
        return {
          list_id: listId,
          ingredient_id: a.ingredient_id,
          quantity: a.quantity,
          unit: a.unit,
          scheduled_purchase_day: scheduledDay,
        }
      })
    if (itemRows.length === 0) continue
    const { error: insItemsErr } = await admin
      .from('grocery_items')
      .insert(itemRows)
    if (insItemsErr) return { ok: false, detail: insItemsErr.message }
    totalItems += itemRows.length
  }

  return { ok: true, listIds, itemCount: totalItems }
}

// Back-compat alias for the previous name. Old call sites can keep working
// while we migrate; new code should call `recomputeGroceryListsForMenu`.
export const recomputeGroceryListForMenu = recomputeGroceryListsForMenu
